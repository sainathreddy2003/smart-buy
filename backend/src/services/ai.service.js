import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { CATEGORIES } from "../models/Product.js";
import { structuredRequirementSchema, productSuggestionSchema } from "../validators/ai.validators.js";
import { detectBudget, parseRequirementDeterministically } from "../utils/deterministicParser.js";

// Client is created lazily — GROQ_API_KEY is optional, and the app must be
// able to run (via the deterministic fallback) with it unset entirely.
const client = env.groq.apiKey ? new Groq({ apiKey: env.groq.apiKey }) : null;

/**
 * Sends a chat completion request and returns the parsed JSON object the
 * model produced. Retries once without JSON mode if the model/endpoint
 * rejects response_format (some Groq models don't support it).
 */
export async function completeJSON({ system, user, temperature = 0.4, signal }) {
  if (!client) throw new Error("AI provider not configured (GROQ_API_KEY unset)");

  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const options = { signal, maxRetries: 0 };
  let raw;
  try {
    const response = await client.chat.completions.create({
      model: env.groq.model,
      messages,
      temperature,
      response_format: { type: "json_object" },
    }, options);
    raw = response.choices[0]?.message?.content;
  } catch (err) {
    if (signal?.aborted || err.status !== 400) throw err;
    const response = await client.chat.completions.create({
      model: env.groq.model,
      messages,
      temperature,
    }, options);
    raw = response.choices[0]?.message?.content;
  }

  if (!raw) throw ApiError.internal("AI provider returned an empty response");

  return safeParseJSON(raw);
}

export async function completeChat({ system, history, temperature = 0.5 }) {
  if (!client) {
    throw new ApiError(503, "The AI advisor is not configured yet. Please contact the site owner to enable it.");
  }

  const messages = [{ role: "system", content: system }, ...history];
  let response;
  try {
    response = await client.chat.completions.create({
      model: env.groq.model,
      messages,
      temperature,
      max_completion_tokens: 1200,
    }, { timeout: 15000, maxRetries: 0 });
  } catch (err) {
    // Log only diagnostic categories; provider messages can contain request data.
    console.warn(`[AI] Follow-up chat failed (status=${err.status ?? "unknown"}, type=${err.constructor?.name ?? err.name})`);
    if (err.status === 429) {
      throw new ApiError(503, "The AI advisor is busy or has reached its usage limit. Please try again shortly.");
    }
    if (err.status === 401 || err.status === 403) {
      throw new ApiError(503, "The AI advisor could not connect with its current credentials. Please contact the site owner.");
    }
    if (err instanceof Groq.APIConnectionTimeoutError || err.name === "TimeoutError") {
      throw new ApiError(504, "The AI advisor took too long to respond. Please try again.");
    }
    throw new ApiError(503, "The AI advisor is temporarily unavailable. Please try again shortly.");
  }
  const reply = response.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new ApiError(503, "The AI advisor returned no answer. Please try again.");
  return reply;
}

const REQUIREMENT_SYSTEM_PROMPT = `You are SmartBuy AI's requirement analyzer.
Your ONLY job is to turn a shopper's free-text request into structured search
criteria. You do NOT know anything about actual products, prices, or specs —
never invent a product name, price, or spec. You are interpreting what the
SHOPPER said, nothing else.

Categories you may choose from: ${CATEGORIES.join(", ")}.
All budgets are in Indian Rupees (INR), even if the user didn't say "rupees" —
"70k" means ₹70,000, "1.2 lakh" means ₹120,000.

Respond with ONLY valid JSON (no markdown fences, no commentary) matching
EXACTLY this shape:
{
  "category": "laptop" | "smartphone" | "headphones" | "smartwatch" | "tablet" | "monitor" | null,
  "budget": { "min": number | null, "max": number | null, "currency": "INR" },
  "useCases": string[],
  "requirements": {
    "ram": { "minimum": number | null },
    "storage": { "minimum": number | null },
    "gpu": { "required": boolean },
    "battery": { "minimum": number | null },
    "anc": { "required": boolean },
    "portability": { "important": boolean }
  },
  "priorities": {
    "cpu": number, "gpu": number, "ram": number, "storage": number,
    "display": number, "battery": number, "portability": number
  },
  "keywords": string[],
  "clarificationNeeded": boolean,
  "clarifyingQuestion": string | null
}

Rules for "priorities": these are relative weights (roughly summing to 1)
reflecting what actually matters for the shopper's stated use case — do NOT
default to weighting every dimension evenly. A gaming request should weight
gpu and cpu heavily; a coding/student request should weight ram, cpu and
battery over gpu; a travel/ANC headphone request should weight battery and
portability over anything else. Only set "gpu.required" to true if the use
case genuinely needs a dedicated GPU (gaming, video editing) — not for
everyday laptop use.

Set "clarificationNeeded": true and provide ONE short, specific
"clarifyingQuestion" ONLY if the category truly cannot be determined, or the
request is too vague to search at all (e.g. "suggest something good"). Do NOT
ask for clarification just because budget or use case is missing — infer
sensible defaults instead.`;

/**
 * Converts free text into structured requirements. Tries the AI once, retries
 * once on schema-invalid output, then falls back to a deterministic
 * keyword/regex parser — the app must never fail this step just because the
 * AI is unavailable or misbehaves (spec §42/§43/§44).
 */
export async function analyzeRequirement(text) {
  if (!client) {
    return parseRequirementDeterministically(text);
  }

  const signal = AbortSignal.timeout(3500);
  for (let attempt = 0; attempt < 2 && !signal.aborted; attempt += 1) {
    try {
      const result = await completeJSON({
        system: REQUIREMENT_SYSTEM_PROMPT,
        user: text,
        temperature: 0.2,
        signal,
      });
      const parsed = structuredRequirementSchema.safeParse(result);
      if (parsed.success) {
        const statedBudget = detectBudget(text);
        const budget = statedBudget.max == null
          ? parsed.data.budget
          : statedBudget;
        return { ...parsed.data, budget, source: "ai" };
      }
      console.warn(`[AI] Requirement JSON failed schema validation (attempt ${attempt + 1})`);
    } catch (err) {
      console.warn(`[AI] analyzeRequirement call failed (attempt ${attempt + 1}): ${err.message}`);
    }
  }

  console.warn("[AI] Falling back to deterministic requirement parser");
  return parseRequirementDeterministically(text);
}

const PRODUCT_SUGGESTION_SYSTEM_PROMPT = `You rank SmartBuy AI's available live shopping listings for a shopper's
camera needs. The shopping search has already completed. Select only from
availableProducts and copy each selected name exactly.

You receive the shopper's category, INR budget, use cases, priorities, and
availableProducts. Each listing includes its name, brand, price, and currency.
Those prices are supplied listing data. Never invent missing prices, specs,
product availability, or a product that is absent from the supplied list.

Respond with ONLY valid JSON matching this shape:
{ "products": [ { "name": string, "brand": string, "cameraFit": "strong" | "value" | "uncertain" } ] }

Rules:
- Return up to six supplied listings, ordered by fit for the shopper's photo
  or video needs. Return fewer when appropriate, or an empty list if none fit.
- Mark cameraFit as "strong" only when the model's camera suitability supports
  the request. Use "value" for a cheaper compromise and "uncertain" when
  camera suitability is unclear.
- Use each supplied INR price when considering the budget and preferredMinPrice.
  The preferred minimum is a shopping preference, not evidence of camera quality.
  A higher price, megapixel count, battery size, or low price alone cannot
  establish camera fit.
- A lower-priced model may still have strong camera fit. Include it when the
  available models and stated needs support that judgment. The application
  explains when the returned offers are below the preferred price tier.
- Select only listings within the shopper's stated budget. Avoid returning
  multiple configurations of the same model when another suitable model exists.
- Your response only identifies and orders the supplied listings. Do not add
  price estimates, unsupported specifications, or promises about another search.`;

/**
 * Orders the available live listings for a camera-focused request.
 */
export async function suggestProductNames(requirement, { preferredMinPrice, originalQuery, cameraFocused, availableProducts } = {}) {
  if (!client) return null;

  const signal = AbortSignal.timeout(3500);
  try {
    const result = await completeJSON({
      system: PRODUCT_SUGGESTION_SYSTEM_PROMPT,
      user: JSON.stringify({
        category: requirement.category,
        budget: requirement.budget,
        preferredMinPrice,
        originalQuery,
        cameraFocused,
        availableProducts,
        useCases: requirement.useCases,
        priorities: requirement.priorities,
        keywords: requirement.keywords,
      }),
      temperature: 0.3,
      signal,
    });
    const parsed = productSuggestionSchema.safeParse(result);
    if (!parsed.success) {
      console.warn("[AI] suggestProductNames returned nothing usable");
      return null;
    }
    return parsed.data.products;
  } catch (err) {
    console.warn(`[AI] suggestProductNames call failed: ${err.message}`);
    return null;
  }
}

function safeParseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    throw ApiError.internal("Failed to parse AI response as JSON");
  }
}
