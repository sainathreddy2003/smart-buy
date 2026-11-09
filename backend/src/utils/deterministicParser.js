// Rule-based extraction of structured shopping requirements from free text.
// This is the AI fallback (used when GROQ_API_KEY is unset, or when the
// model's JSON response fails schema validation twice) — the app must be
// able to run this exact pipeline with zero AI involvement.

import { CATEGORIES } from "../models/Product.js";

const CATEGORY_KEYWORDS = {
  laptop: ["laptop", "notebook", "macbook", "ultrabook"],
  smartphone: ["phone", "smartphone", "iphone", "mobile"],
  headphones: ["headphone", "headphones", "earbuds", "earphone", "earphones", "buds", "anc"],
  smartwatch: ["smartwatch", "watch", "fitness band", "fitness tracker"],
  tablet: ["tablet", "ipad"],
  monitor: ["monitor", "display screen", "external display"],
};

// Each use-case keyword maps to a priority-weight profile (spec §14's worked
// examples) and a small set of hard requirement floors.
const USE_CASE_PROFILES = [
  {
    id: "gaming",
    keywords: ["gaming", "games", "game", "esports", "fps"],
    priorities: { cpu: 0.25, gpu: 0.3, ram: 0.15, storage: 0.05, display: 0.15, battery: 0.02, portability: 0.08 },
    requirements: { gpu: { required: true }, ram: { minimum: 16 } },
  },
  {
    id: "video editing",
    keywords: ["video editing", "premiere", "davinci", "resolve", "after effects", "editing videos", "film editing"],
    priorities: { cpu: 0.3, gpu: 0.25, ram: 0.2, storage: 0.1, display: 0.1, battery: 0.02, portability: 0.03 },
    requirements: { gpu: { required: true }, ram: { minimum: 16 }, storage: { minimum: 512 } },
  },
  {
    id: "coding",
    keywords: ["coding", "programming", "developer", "development", "cse", "software engineer", "college", "student"],
    priorities: { cpu: 0.22, gpu: 0.03, ram: 0.25, storage: 0.1, display: 0.1, battery: 0.2, portability: 0.1 },
    requirements: { ram: { minimum: 16 } },
  },
  {
    id: "photography",
    keywords: ["camera", "photography", "photos", "photo"],
    priorities: { cpu: 0.15, gpu: 0.02, ram: 0.1, storage: 0.15, display: 0.15, battery: 0.23, portability: 0.2 },
    requirements: {},
  },
  {
    id: "battery",
    keywords: ["battery life", "all day battery", "long battery", "battery"],
    priorities: { cpu: 0.1, gpu: 0.02, ram: 0.08, storage: 0.1, display: 0.1, battery: 0.4, portability: 0.2 },
    requirements: { battery: { minimum: 10 } },
  },
  {
    id: "anc travel",
    keywords: ["anc", "noise cancelling", "noise cancellation", "travel", "flight"],
    priorities: { cpu: 0, gpu: 0, ram: 0, storage: 0, display: 0.05, battery: 0.35, portability: 0.25 },
    requirements: { anc: { required: true } },
  },
  {
    id: "gym",
    keywords: ["gym", "workout", "running", "run", "fitness", "sport"],
    priorities: { cpu: 0, gpu: 0, ram: 0, storage: 0, display: 0.05, battery: 0.3, portability: 0.35 },
    requirements: {},
  },
  {
    id: "everyday",
    keywords: ["everyday", "daily use", "general use", "casual"],
    priorities: { cpu: 0.15, gpu: 0.05, ram: 0.15, storage: 0.15, display: 0.15, battery: 0.2, portability: 0.15 },
    requirements: {},
  },
];

const DEFAULT_PRIORITIES = {
  cpu: 0.18,
  gpu: 0.07,
  ram: 0.17,
  storage: 0.13,
  display: 0.15,
  battery: 0.17,
  portability: 0.13,
};

function detectCategory(text) {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => text.includes(k))) return category;
  }
  return null;
}

export function detectBudget(text) {
  const amount = String.raw`(\d[\d,]*(?:\.\d+)?)\s*(lakh(?:s)?\b|lac(?:s)?\b|k\b)?`;
  const currency = String.raw`(?:₹|rs\.?|inr)\s*`;
  const ceiling = String.raw`(?:under|below|within|up to|upto|less than|at most|max(?:imum)?|budget(?:\s*(?:of|is|:|up to))?)\s*`;
  const priceEnd = String.raw`(?![\d,]|\.\d|\s*(?:gb|tb|hours?|mah|hz)\b)`;
  const explicit = new RegExp(String.raw`\b${ceiling}(?:${currency})?${amount}${priceEnd}`, "gi");
  const marked = new RegExp(`${currency}${amount}`, "gi");
  const shorthand = /\b(\d+(?:\.\d+)?)\s*(lakh(?:s)?|lac(?:s)?|k)\b/gi;
  const range = new RegExp(String.raw`\b(?:between|from)\s*(?:${currency})?${amount}\s*(?:and|to)\s*(?:${currency})?${amount}${priceEnd}`, "gi");
  const ceilingMatch = Array.from(text.matchAll(explicit)).at(-1);
  const rangeMatch = Array.from(text.matchAll(range)).at(-1);
  if (rangeMatch && rangeMatch.index > (ceilingMatch?.index ?? -1)) {
    return {
      min: budgetAmount(rangeMatch[1], rangeMatch[2] ?? rangeMatch[4]),
      max: budgetAmount(rangeMatch[3], rangeMatch[4]),
      currency: "INR",
    };
  }

  const match = ceilingMatch
    ?? Array.from(text.matchAll(marked)).at(-1)
    ?? Array.from(text.matchAll(shorthand)).at(-1);
  if (!match) return { min: null, max: null, currency: "INR" };

  return { min: 0, max: budgetAmount(match[1], match[2]), currency: "INR" };
}

function budgetAmount(amount, unit) {
  const multiplier = unit?.toLowerCase() === "k" ? 1000 : unit ? 100000 : 1;
  return Math.round(Number(amount.replace(/,/g, "")) * multiplier);
}

function detectRAM(text) {
  const match = text.match(/(\d+)\s*gb\s*ram|ram\s*(?:of\s*)?(\d+)\s*gb/);
  const value = match ? Number(match[1] || match[2]) : null;
  return value;
}

function detectStorage(text) {
  const tb = text.match(/(\d+(?:\.\d+)?)\s*tb\b/);
  if (tb) return Number(tb[1]) * 1024;
  const gb = text.match(/(\d+)\s*gb\s*(?:ssd|storage)/);
  return gb ? Number(gb[1]) : null;
}

function matchUseCaseProfiles(text) {
  return USE_CASE_PROFILES.filter((profile) => profile.keywords.some((k) => text.includes(k)));
}

function blendPriorities(profiles) {
  if (profiles.length === 0) return { ...DEFAULT_PRIORITIES };

  const dims = ["cpu", "gpu", "ram", "storage", "display", "battery", "portability"];
  const summed = Object.fromEntries(dims.map((d) => [d, 0]));
  for (const profile of profiles) {
    for (const d of dims) summed[d] += profile.priorities[d] ?? 0;
  }
  const total = dims.reduce((sum, d) => sum + summed[d], 0) || 1;
  return Object.fromEntries(dims.map((d) => [d, Math.round((summed[d] / total) * 1000) / 1000]));
}

/**
 * Deterministic requirement extraction — no AI involved. Returns the same
 * shape as the AI path (see validators/ai.validators.js), so the rest of the
 * pipeline never needs to know which one produced it.
 */
export function parseRequirementDeterministically(rawText) {
  const text = String(rawText || "").toLowerCase();

  const category = detectCategory(text);
  const budget = detectBudget(text);
  const profiles = matchUseCaseProfiles(text);
  const ramMin = detectRAM(text);
  const storageMin = detectStorage(text);

  const requirements = {
    ram: { minimum: ramMin ?? profiles.find((p) => p.requirements.ram)?.requirements.ram.minimum ?? null },
    storage: { minimum: storageMin ?? profiles.find((p) => p.requirements.storage)?.requirements.storage.minimum ?? null },
    gpu: { required: profiles.some((p) => p.requirements.gpu?.required) },
    battery: { minimum: profiles.find((p) => p.requirements.battery)?.requirements.battery.minimum ?? null },
    anc: { required: profiles.some((p) => p.requirements.anc?.required) },
    portability: { important: profiles.some((p) => p.id === "gym" || p.id === "anc travel" || p.id === "coding") },
  };

  const clarificationNeeded = !category;
  const clarifyingQuestion = clarificationNeeded
    ? "What kind of product are you shopping for — a laptop, smartphone, headphones, smartwatch, tablet, or monitor?"
    : null;

  return {
    category,
    budget,
    useCases: profiles.map((p) => p.id),
    requirements,
    priorities: blendPriorities(profiles),
    keywords: [...new Set(text.match(/[a-z][a-z\s]{2,}/g) || [])].slice(0, 8),
    clarificationNeeded,
    clarifyingQuestion,
    source: "deterministic",
  };
}

export { CATEGORIES };
