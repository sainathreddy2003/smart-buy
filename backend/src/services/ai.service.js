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
  if (!client) throw new Error("AI provider not configured (GROQ_API_KEY unset)");

  const messages = [{ role: "system", content: system }, ...history];
  const response = await client.chat.completions.create({
    model: env.groq.model,
    messages,
    temperature,
  });
  return response.choices[0]?.message?.content ?? "";
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

const PRODUCT_SUGGESTION_SYSTEM_PROMPT = `You are SmartBuy AI's product shortlisting step. Your ONLY job is deciding
WHICH real products are worth looking up next — you never state their price
or specs yourself, because a live shopping search does that afterward from
real data. Today's date is ${new Date().toISOString().slice(0, 10)}; suggest
products actually sold in India right now, not discontinued ones.

You will receive a structured shopper requirement (category, budget, use
cases, priorities). Respond with ONLY valid JSON (no markdown fences, no
commentary) matching EXACTLY this shape:
{ "products": [ { "name": string, "brand": string, "cameraFit"?: "strong" | "value" | "uncertain" } ] }

Rules:
- "name" must be a real, currently-sold brand + model, e.g. "OnePlus 13",
  "Samsung Galaxy S25", "Motorola Edge 60 Pro" — never invent a model, never
  a vague description like "a good gaming laptop".
- Suggest 4 to 6 products realistically priced within or near the stated
  budget for the given category and use case. If preferredMinPrice is supplied,
  prioritize models likely to sell above that price and within the ceiling.
  Include a cheaper model only as a value alternative.
- When cameraFocused is true, order the names by fit for the shopper's photo
  or video needs. Mark cameraFit as "strong" only for a model you would
  shortlist for those needs. Use "value" for a cheaper compromise and
  "uncertain" when camera suitability is unclear. For a best-camera request
  with room for camera flagships, favor established camera-focused models.
  Battery life, megapixel count, and low price alone don't establish camera fit.
- Favor products actually common in the Indian market (Samsung, OnePlus,
  Xiaomi, Realme, Motorola, Vivo, Oppo, Apple, Nothing, Asus, Lenovo, HP,
  Dell, Acer, boAt, Noise, JBL, Sony, etc.) over obscure or region-locked ones.
- Do not include price or spec numbers in your answer — that is looked up
  for real afterward. Your only job is picking which real products to look up.
- If you're not confident a product genuinely exists and is currently sold,
  omit it rather than guessing.`;

/**
 * Names real, currently-sold products worth searching live shopping APIs
 * for — the AI proposes WHICH products to look up, it never states their
 * price/specs itself. This exists because a generic keyword search (e.g.
 * "smartphone gaming budget") against a shopping API returns whatever
 * loosely matches those words, which is often irrelevant; searching for an
 * AI-suggested specific model name ("OnePlus 13") returns that actual
 * product's real listings instead. A hallucinated name simply returns zero
 * live results and gets silently dropped by the caller — see
 * fetchCandidates in recommendation.service.js, which falls back to the
 * live keyword search if this returns
 * nothing usable, so this step is an optimization, never a hard dependency.
 */
export async function suggestProductNames(requirement, { preferredMinPrice, originalQuery, cameraFocused } = {}) {
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
