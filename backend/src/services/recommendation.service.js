import { Product } from "../models/Product.js";
import { Recommendation, serializeRecommendation } from "../models/Recommendation.js";
import { PriceHistory } from "../models/PriceHistory.js";
import { ApiError } from "../utils/ApiError.js";
import { parseRequirementDeterministically } from "../utils/deterministicParser.js";
import { searchProducts, isLiveModeActive } from "./productSearch.service.js";
import { verifyRetailerPrices } from "./retailerPrices.service.js";
import { suggestProductNames } from "./ai.service.js";
import { mergeSellerOffers } from "../utils/duplicateDetection.js";
import { parseRAM, parseStorage, tierFromCPU, tierFromGPU } from "../utils/normalization.js";

const MAX_SUGGESTED_PRODUCTS = 5;
const NAMED_SEARCH_TIMEOUT_MS = 17000;
const KEYWORD_SEARCH_TIMEOUT_MS = 15000;
const RESULTS_PER_SUGGESTED_PRODUCT = 2;
const PREFERRED_LAPTOP_BUDGET_RATIO = 0.65;
const LOW_COST_REQUEST = /\b(?:cheapest|cheap|affordable|budget[- ]friendly|best value|lower[- ]cost|cheaper|spend less|lowest price)\b/i;
const CAMERA_REQUEST = /\b(?:camera|photography|videography|vlogging|photos?|video recording|portraits?)\b/i;

const DIMENSIONS = ["cpu", "gpu", "ram", "storage", "display", "battery", "portability"];

function getSpecString(product, key) {
  const specs = product.specs;
  if (!specs) return "";
  if (typeof specs.get === "function") return specs.get(key) || "";
  return specs[key] || "";
}

function hasANC(product) {
  const anc = getSpecString(product, "ANC");
  return Boolean(anc) && !/none/i.test(anc);
}

/**
 * Converts either the legacy guided-wizard body ({category, budgetMin,
 * budgetMax, useCase, mustHaveFeatures, notes}) or the AI/deterministic
 * structured-requirement shape into one canonical requirement object the
 * engine scores against. The wizard path is normalized by describing the
 * user's picks as a sentence and running it through the SAME deterministic
 * parser used for free-text fallback — one codepath for "turn stated needs
 * into priorities," regardless of how those needs were stated.
 */
export function normalizeToRequirement(body) {
  const isLegacyWizardShape = body.budgetMin !== undefined || body.budgetMax !== undefined || body.useCase !== undefined;

  if (!isLegacyWizardShape && body.priorities && body.requirements) {
    return body;
  }

  const sentence = [
    body.category,
    body.useCase ? `for ${body.useCase}` : "",
    ...(body.mustHaveFeatures || []),
    body.notes || "",
    body.budgetMax ? `budget ${body.budgetMax}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const parsed = parseRequirementDeterministically(sentence);
  return {
    ...parsed,
    category: body.category || parsed.category,
    budget: {
      min: body.budgetMin ?? parsed.budget.min,
      max: body.budgetMax ?? parsed.budget.max,
      currency: "INR",
    },
    useCases: body.useCase ? [body.useCase, ...parsed.useCases.filter((u) => u !== body.useCase)] : parsed.useCases,
  };
}

// Only use specs that can be distinguished in listing text.
function normalizeFromTitle(result, category) {
  const text = [result.name, result._rawTitle, result._rawDescription].filter(Boolean).join(" ");
  if (category !== "laptop") {
    return { ramGB: parseRAM(text) ?? undefined, storageGB: parseStorage(text) ?? undefined };
  }

  const ram = text.match(/\b\d+\s*gb\s*(?:ram|(?:lp)?ddr[345])\b|\b(?:ram|unified memory)\s*[:=-]?\s*\d+\s*gb\b|\b\d+\s*gb\s*(?:unified )?memory\b/i);
  const storage = text.match(/\b\d+(?:\.\d+)?\s*(?:gb|tb)\s*(?:ssd|hdd|storage)\b|\b(?:ssd|hdd|storage)\s*[:=-]?\s*\d+(?:\.\d+)?\s*(?:gb|tb)\b/i);
  const cpu = text.match(/\b(?:core\s+(?:ultra\s+)?[3579]|i[3579]|ryzen\s+[3579]|(?:apple\s+|macbook\s+(?:air|pro)\s+)m[1-4](?:\s+(?:pro|max))?|celeron|pentium)\b/i);
  const gpu = text.match(/\b(?:rtx|gtx)\s*\d{4}\b|\bradeon\s+rx\s*\d{4}\b/i);
  return {
    ramGB: parseRAM(ram?.[0]) ?? undefined,
    storageGB: parseStorage(storage?.[0]) ?? undefined,
    cpuTier: cpu ? tierFromCPU(cpu[0]) : undefined,
    gpuTier: gpu ? tierFromGPU(gpu[0]) : undefined,
  };
}

function toVirtualCandidate(result, category) {
  const sellers = [...result.sellers].sort((a, b) => a.price - b.price);
  const offer = sellers[0];
  return {
    name: result.name,
    brand: result.brand || "Unknown",
    category,
    sellers,
    bestPrice: offer.price,
    rating: Number.isFinite(result.rating) && result.rating >= 0 && result.rating <= 5 ? result.rating : 0,
    images: result.image ? [result.image] : [],
    specs: {},
    normalizedSpecs: normalizeFromTitle(result, category),
    useCases: [],
    source: result.source,
    sourceProductId: result.sourceProductId,
    shoppingHistoryId: result.shoppingHistoryId,
  };
}

function mergeOrCreateCandidate(result, category, candidates) {
  const incoming = toVirtualCandidate(result, category);
  const match = candidates.find((candidate) =>
    candidate.name.toLowerCase() === incoming.name.toLowerCase() &&
    candidate.brand.toLowerCase() === incoming.brand.toLowerCase()
  );
  if (!match) {
    candidates.push(incoming);
    return;
  }

  for (const seller of incoming.sellers) {
    const existing = match.sellers.find((offer) => offer.platform === seller.platform);
    if (!existing || seller.price < existing.price) mergeSellerOffers(match, seller);
  }
  match.sellers.sort((a, b) => a.price - b.price);
}

/**
 * Primary live-candidate path: ask the AI which real, currently-sold
 * products fit this requirement (a NLU-adjacent step, not fact invention —
 * see suggestProductNames), then search live shopping APIs for each named
 * product by name instead of by generic keywords. Searching "OnePlus 13"
 * returns that actual phone's real listings; searching "smartphone gaming
 * under 70000" returns whatever loosely matches those words, which is often
 * irrelevant. A hallucinated or discontinued name just returns zero live
 * results for that one search and is silently skipped — nothing here trusts
 * the AI's output as fact, only as a lookup key.
 */
async function buildCandidatesFromNamedSuggestions(requirement, options) {
  const suggestions = await suggestProductNames(requirement, options);
  if (options.cameraFocused && !suggestions) {
    throw new ApiError(503, "The camera-phone shortlist is temporarily unavailable. Please try again shortly.");
  }
  const signal = AbortSignal.timeout(NAMED_SEARCH_TIMEOUT_MS);
  const candidates = [];
  const models = (suggestions || []).filter(({ cameraFit }) => !options.cameraFocused || cameraFit === "strong");
  const uniqueModels = models.filter(({ name }, i) => models.findIndex((model) => model.name.toLowerCase() === name.toLowerCase()) === i);

  const results = await Promise.allSettled(uniqueModels.slice(0, MAX_SUGGESTED_PRODUCTS).map(({ name, brand }) => searchProducts(name, {
    category: requirement.category,
    budget: requirement.budget,
    modelName: name,
    modelBrand: brand,
    limit: options.cameraFocused ? 1 : RESULTS_PER_SUGGESTED_PRODUCT,
    signal,
  })));
  if (options.cameraFocused && results.length && results.every(({ status }) => status === "rejected")) {
    throw results[0].reason;
  }
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const listing of result.value) mergeOrCreateCandidate(listing, requirement.category, candidates);
  }
  return candidates;
}

async function fetchCandidates(requirement, originalQuery, cameraFocused) {
  const { category, budget } = requirement;
  if (!category) throw ApiError.badRequest("Could not determine a product category for this request");
  if (budget?.min != null && budget?.max != null && budget.min > budget.max) {
    throw ApiError.badRequest("The minimum budget must be at or below the maximum.");
  }
  if (!isLiveModeActive()) {
    throw new ApiError(503, "Live shopping search is unavailable. Please try again later.");
  }

  // A stated range is already explicit. A lone ceiling gives us a preferred
  // shopping band, while cheaper alternatives are still eligible.
  const preferredMinPrice = category === "laptop" && !budget?.min && budget?.max
    && !LOW_COST_REQUEST.test(originalQuery || "")
    ? Math.ceil(budget.max * PREFERRED_LAPTOP_BUDGET_RATIO)
    : undefined;
  const keywords = [...(requirement.useCases || []), ...(requirement.keywords || []).slice(0, 4)]
    .join(" ").trim() || category;
  const [namedSearch, preferredSearch] = await Promise.allSettled([
    buildCandidatesFromNamedSuggestions(requirement, { preferredMinPrice, originalQuery, cameraFocused }),
    preferredMinPrice == null ? [] : searchProducts(
      `${category} ${(requirement.useCases || []).join(" ")} ₹${preferredMinPrice} to ₹${budget.max}`,
      { category, budget, preferredMinPrice, limit: 15, signal: AbortSignal.timeout(KEYWORD_SEARCH_TIMEOUT_MS) }
    ),
  ]);

  if (namedSearch.status === "rejected") throw namedSearch.reason;
  const candidates = namedSearch.value;
  if (preferredSearch.status === "fulfilled") {
    for (const listing of preferredSearch.value) mergeOrCreateCandidate(listing, category, candidates);
  }

  if (!candidates.length && !cameraFocused) {
    const budgetQuery = budget?.max != null ? ` under ₹${budget.max}` : "";
    const searchOptions = { category, budget, limit: 15, signal: AbortSignal.timeout(KEYWORD_SEARCH_TIMEOUT_MS) };
    let results = await searchProducts(keywords + budgetQuery, searchOptions);
    if (!results.length && !searchOptions.signal.aborted) {
      results = await searchProducts(
        `${keywords} (site:amazon.in OR site:flipkart.com OR site:croma.com)`,
        searchOptions,
      );
    }
    for (const result of results) mergeOrCreateCandidate(result, category, candidates);
  }

  if (!candidates.length) {
    const budgetMessage = budget?.max != null
      ? ` within your ₹${budget.max.toLocaleString("en-IN")} budget`
      : budget?.min ? ` at or above ₹${budget.min.toLocaleString("en-IN")}` : "";
    const product = cameraFocused ? "a shortlisted camera phone" : `a ${category}`;
    throw ApiError.notFound(`I couldn’t find ${product} to check against Amazon India and Flipkart${budgetMessage}.`);
  }
  const preferred = preferredMinPrice == null ? [] : candidates.filter((product) => product.bestPrice >= preferredMinPrice);
  return {
    candidates: preferred.length ? preferred : candidates,
    preferredMinPrice,
  };
}

async function persistChosenPicks(topEntries) {
  for (const entry of topEntries) {
    const product = entry.product;
    const offer = product.sellers[0];
    // Keep seeded products separate. Refresh the offer set only for the same
    // live listing so stale or demo sellers cannot set the displayed price.
    const identity = {
      category: product.category,
      source: product.source,
      name: product.name.slice(0, 120),
      ...(product.sourceProductId && { sourceProductId: product.sourceProductId }),
    };
    const saved = await Product.findOneAndUpdate(identity, {
      $set: {
        ...identity,
        brand: product.brand,
        sellers: product.sellers,
        bestPrice: product.bestPrice,
        rating: product.rating,
        images: product.images,
        normalizedSpecs: product.normalizedSpecs,
        ...(product.shoppingHistoryId && { shoppingHistoryId: product.shoppingHistoryId }),
      },
    }, { upsert: true, returnDocument: "after", runValidators: true });
    await PriceHistory.create({ product: saved._id, platform: offer.platform, price: offer.price, source: "live" });
    entry.product = saved;
  }
}

function normalize(value, max) {
  if (value == null || !max) return 0;
  return Math.min(1, value / max);
}

/** The dynamic per-dimension spec score — this is where `priorities` actually bites. */
function specScore(product, requirement, candidateMaxes) {
  const specs = product.normalizedSpecs || {};
  const priorities = requirement.priorities || {};

  const dimensionValues = {
    cpu: normalize(specs.cpuTier, 5),
    gpu: normalize(specs.gpuTier, 5),
    ram: normalize(specs.ramGB, candidateMaxes.ramGB),
    storage: normalize(specs.storageGB, candidateMaxes.storageGB),
    display: normalize(specs.displayScore, 5),
    battery: normalize(specs.batteryHours, candidateMaxes.batteryHours),
    portability: normalize(specs.portabilityScore, 5),
  };

  const weightSum = DIMENSIONS.reduce((sum, d) => sum + (priorities[d] || 0), 0) || 1;
  const weighted = DIMENSIONS.reduce((sum, d) => sum + (priorities[d] || 0) * dimensionValues[d], 0);
  return (weighted / weightSum) * 100;
}

function intentMatchScore(product, requirement) {
  const reqs = requirement.requirements || {};
  const checks = [];

  if (requirement.useCases?.length) {
    const matched = requirement.useCases.filter((u) => product.useCases?.includes(u)).length;
    checks.push(matched / requirement.useCases.length);
  }
  if (reqs.ram?.minimum) checks.push((product.normalizedSpecs?.ramGB || 0) >= reqs.ram.minimum ? 1 : 0);
  if (reqs.storage?.minimum) checks.push((product.normalizedSpecs?.storageGB || 0) >= reqs.storage.minimum ? 1 : 0);
  if (reqs.gpu?.required) checks.push((product.normalizedSpecs?.gpuTier || 0) > 0 ? 1 : 0);
  if (reqs.battery?.minimum) checks.push((product.normalizedSpecs?.batteryHours || 0) >= reqs.battery.minimum ? 1 : 0);
  if (reqs.anc?.required) checks.push(hasANC(product) ? 1 : 0);

  if (checks.length === 0) return 70; // no explicit asks -> neutral-positive
  return (checks.reduce((a, b) => a + b, 0) / checks.length) * 100;
}

function ratingScore(product) {
  return (product.rating / 5) * 100;
}

function priceScoreFor(product, requirement, candidateMaxPrice) {
  const price = product.bestPrice;
  if (requirement.budget?.max) {
    if (price > requirement.budget.max) return 0;
    return 100 - ((requirement.budget.max - price) / requirement.budget.max) * 30;
  }
  return 100 - normalize(price, candidateMaxPrice) * 50;
}

/**
 * "Value" relative to what the shopper actually said they'd spend — not raw
 * spec-per-rupee across the whole catalog. Pure spec-per-rupee mathematically
 * always crowns the cheapest "good enough" item, which fights specScore and
 * buries a pricier-but-genuinely-better pick that's still well within budget
 * (e.g. it would rank a ₹12k phone's camera as "better value" than an iPhone
 * at ₹72k against an ₹80k budget, which isn't what a shopper asking for the
 * best pick under ₹80k actually wants). Instead: full specScore credit for
 * spending close to the budget on real capability, tapering to a modest
 * (≤30%) bonus for spending well under it — affordability still counts, it
 * just doesn't override how good the product actually is.
 */
function valueScoreFor(product, requirement, spec, candidateMaxes) {
  if (requirement.budget?.max) {
    const utilization = Math.min(1, product.bestPrice / requirement.budget.max);
    return spec * (0.7 + 0.3 * (1 - utilization));
  }
  return normalize(spec / Math.max(1, product.bestPrice), candidateMaxes.valueRatio) * 100;
}

function scoreProduct(product, requirement, candidateMaxes) {
  const spec = specScore(product, requirement, candidateMaxes);
  const intent = intentMatchScore(product, requirement);
  const rating = ratingScore(product);
  const price = priceScoreFor(product, requirement, candidateMaxes.bestPrice);
  const value = valueScoreFor(product, requirement, spec, candidateMaxes);

  const final = spec * 0.4 + intent * 0.3 + value * 0.15 + rating * 0.1 + price * 0.05;

  return {
    final: Math.round(Math.min(100, Math.max(0, final))),
    breakdown: { specScore: Math.round(spec), intentMatchScore: Math.round(intent), valueScore: Math.round(value), ratingScore: Math.round(rating), priceScore: Math.round(price) },
  };
}

/**
 * Rule-based, data-grounded explanation bullets — never AI-generated text
 * standing in for facts. Every bullet references a real field on `product`.
 */
function generateExplanation(product, requirement) {
  const bullets = [];
  const reqs = requirement.requirements || {};
  const specs = product.normalizedSpecs || {};

  if (reqs.ram?.minimum && specs.ramGB) {
    bullets.push(
      specs.ramGB >= reqs.ram.minimum
        ? `${specs.ramGB}GB RAM meets your ${reqs.ram.minimum}GB+ requirement`
        : `${specs.ramGB}GB RAM is below the ${reqs.ram.minimum}GB you asked for`
    );
  }
  if (reqs.gpu?.required) {
    bullets.push(
      specs.gpuTier > 0
        ? `Dedicated GPU (${getSpecString(product, "GPU") || "discrete graphics"}) accelerates ${requirement.useCases?.[0] || "your"} workloads`
        : "A dedicated GPU could not be verified from the listing"
    );
  }
  if (reqs.storage?.minimum && specs.storageGB) {
    bullets.push(
      specs.storageGB >= reqs.storage.minimum
        ? `${specs.storageGB}GB storage meets your requirement`
        : `${specs.storageGB}GB storage is below the ${reqs.storage.minimum}GB you asked for`
    );
  }
  if (reqs.anc?.required) {
    bullets.push(hasANC(product) ? "Active noise cancellation included" : "Active noise cancellation could not be verified from the listing");
  }
  if (reqs.battery?.minimum && specs.batteryHours) {
    bullets.push(
      specs.batteryHours >= reqs.battery.minimum
        ? `~${specs.batteryHours}h battery life covers your all-day use`
        : `~${specs.batteryHours}h battery life is on the shorter side`
    );
  }

  if (requirement.budget?.max != null) {
    bullets.push(`₹${product.bestPrice.toLocaleString("en-IN")} fits within your ₹${requirement.budget.max.toLocaleString("en-IN")} budget`);
  }

  const matchedUseCases = requirement.useCases?.filter((u) => product.useCases?.includes(u));
  if (matchedUseCases?.length) {
    bullets.push(`Well suited for ${matchedUseCases.join(", ")}`);
  }

  if (bullets.length === 0) {
    bullets.push(`Listed at ₹${product.bestPrice.toLocaleString("en-IN")}`);
  }

  return bullets.slice(0, 6);
}

function generateTradeoff(product, requirement, candidates, rankedScores) {
  const myScore = rankedScores.find((r) => r.product === product);
  const cheaper = candidates.filter((c) => c.bestPrice < product.bestPrice).length;
  if (cheaper >= Math.ceil(candidates.length / 2)) {
    return "Priced higher than most alternatives found for this search.";
  }
  if (product.rating > 0 && myScore?.breakdown.ratingScore < 80) {
    return "Rated slightly lower than the top picks — worth reading a couple of reviews before deciding.";
  }
  const reqs = requirement.requirements || {};
  const gpuTier = product.normalizedSpecs?.gpuTier || 0;
  if (reqs.gpu?.required && gpuTier === 0) {
    return "Check the retailer’s specs for a dedicated GPU before buying for GPU-heavy work.";
  }
  if (reqs.gpu?.required && gpuTier <= 2) {
    return "GPU is present but modest — fine for lighter workloads, may slow down on heavier ones.";
  }
  return "Check the retailer’s listing for full specs before buying.";
}

export { scoreProduct };

function rankProducts(candidates, requirement) {
  const candidateMaxes = {
    ramGB: Math.max(...candidates.map((c) => c.normalizedSpecs?.ramGB || 0)),
    storageGB: Math.max(...candidates.map((c) => c.normalizedSpecs?.storageGB || 0)),
    batteryHours: Math.max(...candidates.map((c) => c.normalizedSpecs?.batteryHours || 0)),
    bestPrice: Math.max(...candidates.map((c) => c.bestPrice)),
    valueRatio: 0,
  };
  candidateMaxes.valueRatio = Math.max(
    ...candidates.map((c) => specScore(c, requirement, candidateMaxes) / Math.max(1, c.bestPrice))
  );

  return candidates
    .map((product) => ({ product, ...scoreProduct(product, requirement, candidateMaxes) }))
    .sort((a, b) => b.final - a.final);
}

export async function generateRecommendation(rawBody, userId, originalQuery) {
  const requirement = normalizeToRequirement(rawBody);
  const cameraFocused = requirement.category === "smartphone"
    && CAMERA_REQUEST.test([...(requirement.useCases || []), ...(requirement.keywords || [])].join(" "));
  const { candidates, preferredMinPrice } = await fetchCandidates(requirement, originalQuery, cameraFocused);
  console.log(`[SEARCH] ${candidates.length} candidates fetched for category "${requirement.category}"`);

  const ordered = cameraFocused ? candidates : rankProducts(candidates, requirement).map(({ product }) => product);
  const checkPrices = async (products) => (await Promise.all(products.map(async (product) => {
    const sellers = await verifyRetailerPrices(product, requirement.budget);
    return sellers.length ? { ...product, sellers, bestPrice: sellers[0].price } : null;
  }))).filter(Boolean);
  let verified = await checkPrices(ordered.slice(0, 3));
  if (cameraFocused && !verified.length && ordered.length > 3) verified = await checkPrices(ordered.slice(3));
  if (!verified.length) {
    throw ApiError.notFound("I couldn’t verify an in-budget price for the shortlisted products on Amazon India or Flipkart.");
  }

  const preferred = preferredMinPrice == null ? [] : verified.filter((product) => product.bestPrice >= preferredMinPrice);
  const lowerPriceFallback = preferredMinPrice != null && !preferred.length;
  const top = cameraFocused ? verified.map((product) => ({ product })) : rankProducts(preferred.length ? preferred : verified, requirement);

  console.log(cameraFocused
    ? `[RECOMMENDER] ${top.length} Groq camera picks with verified prices`
    : `[RECOMMENDER] Top score: ${top[0].final}`);

  const explanations = top.map((entry) => ({
    reasoning: [cameraFocused ? "Shortlisted by Groq for your camera needs" : null, ...generateExplanation(entry.product, requirement)].filter(Boolean).join(" • "),
    tradeoffs: cameraFocused ? "Check independent camera reviews before deciding." : generateTradeoff(entry.product, requirement, verified, top),
  }));

  // Only now — after we know exactly which 3 products are actually being
  // shown — do any of this touch the database.
  await persistChosenPicks(top);

  const picks = top.map((entry, index) => ({
    product: entry.product._id,
    offers: entry.product.sellers,
    rank: index + 1,
    ...(cameraFocused ? { rankingSource: "groq" } : { matchScore: entry.final }),
    reasoning: explanations[index].reasoning,
    tradeoffs: explanations[index].tradeoffs,
  }));

  const recommendation = await Recommendation.create({
    user: userId || undefined,
    preferences: requirement,
    originalQuery: originalQuery || undefined,
    picks,
    summary: cameraFocused
      ? "Groq shortlisted these camera phones. The prices shown were verified with the retailers."
      : lowerPriceFallback
      ? `I couldn’t verify a live offer between ₹${preferredMinPrice.toLocaleString("en-IN")} and ₹${requirement.budget.max.toLocaleString("en-IN")}. Here are lower-priced alternatives within your budget.`
      : `Ranked live listings for ${requirement.useCases?.join(", ") || "your stated needs"}${requirement.budget?.max != null ? ` within ₹${requirement.budget.max.toLocaleString("en-IN")}` : ""}.`,
  });

  await recommendation.populate("picks.product");
  return serializeRecommendation(recommendation);
}
