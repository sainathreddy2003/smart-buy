import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { indianOffers } from "../utils/indianRetailers.js";
import { isWholeProductListing } from "../utils/productListing.js";
import { matchMacbookModel } from "../utils/macbookModel.js";
import { GoogleShoppingProvider } from "./providers/GoogleShoppingProvider.js";
import { RapidApiProductProvider } from "./providers/RapidApiProductProvider.js";
import { SerpApiProvider } from "./providers/SerpApiProvider.js";
import { AmazonProductProvider } from "./providers/AmazonProductProvider.js";
import { FlipkartProductProvider } from "./providers/FlipkartProductProvider.js";
import { wrap } from "./cache.service.js";

const serpApiProvider = new SerpApiProvider();
const rapidApiProvider = new RapidApiProductProvider();
const googleMegaProvider = new GoogleShoppingProvider({ mega: true });
const googleShoppingProvider = new GoogleShoppingProvider();
const amazonProvider = new AmazonProductProvider();
const flipkartProvider = new FlipkartProductProvider();

const LIVE_PROVIDERS = [serpApiProvider, rapidApiProvider, googleMegaProvider, googleShoppingProvider, amazonProvider, flipkartProvider];
const PROVIDER_TIMEOUT_MS = 3200;
const PRODUCT_SEARCH_TIMEOUT_MS = 5000;
const RETAILER_SEARCH_TIMEOUT_MS = 6500;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const NON_NEW_TITLE = /\b(?:refurbished|renewed|pre[- ]owned|second[- ]hand|open[- ]box|used)\b/i;
const MODEL_SUFFIX = /^(?:pro|max|plus|ultra|mini|lite|fe|se|xl|power|fold|flip|fusion|neo|edge)\b/;
const MACBOOK_SCREEN_SIZE = /\b(macbook (?:air|pro)) (?:13(?: 6)?|14|15|16) (?=m[1-9]\b)/;

function normalizedTitle(title) {
  const value = title.toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/(\d)plus\b/g, "$1 plus")
    .replace(/\b(\d+(?:\.\d+)?)\s*(gb|tb)\b/g, "$1$2")
    // Retailers insert the screen size before the chip in MacBook names.
    // Canonicalize its optional unit without removing the explicit size.
    .replace(/\b(macbook\s+(?:air|pro))\s+(13(?:\.6)?|14|15|16)(?:\s*-?\s*(?:inch(?:es)?|in\b|["″]))?\s+(?=m[1-9]\b)/gi, "$1 $2 ");
  return ` ${value.replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function matchesModel(title, model, brand) {
  let name = normalizedTitle(title);
  // Only ignore this narrowly defined insertion when the requested model
  // omits a size. A supplied size, chip, suffix or capacity must still match.
  if (!MACBOOK_SCREEN_SIZE.test(model)) name = name.replace(MACBOOK_SCREEN_SIZE, "$1 ");
  // Retailers may put the colour before a requested phone capacity. Keep
  // that capacity mandatory without treating the colour as another model.
  const capacities = model.match(/\b\d+(?:\.\d+)?(?:gb|tb)\b/g) || [];
  const trailingCapacity = model.match(/ (\d+(?:\.\d+)?(?:gb|tb)) $/);
  if (capacities.length === 1 && trailingCapacity) {
    if (!name.includes(` ${trailingCapacity[1]} `)) return false;
    model = model.slice(0, -trailingCapacity[0].length) + " ";
  }
  const withoutBrand = brand && model.length > brand.length && model.startsWith(brand) ? ` ${model.slice(brand.length)}` : model;
  const index = name.indexOf(withoutBrand);
  if (index < 0 || MODEL_SUFFIX.test(name.slice(index + withoutBrand.length))) return false;
  // Naming a compatible model is not enough: that model must be the subject
  // of the listing, optionally preceded by its manufacturer or simple promo.
  const prefix = name.slice(0, index).trim()
    .replace(/\b(?:new|brand new|latest|original|genuine|unlocked|20\d{2})\b/g, " ")
    .replace(/\s+/g, " ").trim();
  const manufacturer = brand?.trim();
  return !prefix || prefix === manufacturer
    || (manufacturer === "redmi" && prefix === "xiaomi redmi")
    || (manufacturer === "poco" && prefix === "xiaomi poco");
}

export function matchesShoppingModel(title, modelName, modelBrand) {
  const macbookMatch = matchMacbookModel(title, modelName, modelBrand);
  if (macbookMatch !== null) return macbookMatch;
  return matchesModel(title, normalizedTitle(modelName), modelBrand && normalizedTitle(modelBrand));
}

export function isLiveModeActive() {
  return !env.useMockData && Boolean(env.serpApi.key || env.rapidApi.key);
}

// A caller's overall deadline stops only its wait. The cached provider call
// has its own timeout so one shopper cannot cancel another shopper's lookup.
function waitForSharedSearch(request, signal) {
  if (!signal) return request;
  return new Promise((resolve, reject) => {
    const complete = (finish, value) => {
      signal.removeEventListener("abort", onAbort);
      finish(value);
    };
    const onAbort = () => complete(reject, signal.reason);
    request.then((value) => complete(resolve, value), (error) => complete(reject, error));
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Recommendation lookups must be tied to a validated Groq model, never keywords. */
export async function searchSuggestedProduct(model, options = {}) {
  if (typeof model?.name !== "string" || !model.name.trim()
    || typeof model?.brand !== "string" || !model.brand.trim()) {
    throw ApiError.badRequest("A specific suggested product model and brand are required.");
  }
  const brand = model.brand.trim();
  const name = model.name.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  const query = name.toLowerCase().startsWith(`${brand.toLowerCase()} `) ? name : `${brand} ${name}`;
  return searchProducts(query, {
    ...options, modelName: query, modelBrand: brand,
  });
}

export async function searchProducts(query, { budget, modelName, modelBrand, preferredMinPrice, retailers, signal, limit = 15, ...opts } = {}) {
  if (!isLiveModeActive()) return [];

  const model = modelName && normalizedTitle(modelName);
  const searchQuery = modelName ? modelName.trim() : query;
  // Look beyond the first few listings before filtering by budget and seller.
  const providerOptions = { ...opts, exactModel: Boolean(modelName), limit: Math.max(limit, 15) };
  let completed = false;
  for (const provider of LIVE_PROVIDERS) {
    if (signal?.aborted) break;
    // Native retailer searches are only a fallback for a specific Groq model.
    if ((provider === amazonProvider || provider === flipkartProvider) && !model) continue;
    if (provider === flipkartProvider && !env.rapidApi.flipkartSearchConfig) continue;
    const key = provider === serpApiProvider ? env.serpApi.key : env.rapidApi.key;
    if (!key) continue;
    const providerName = provider.host ?? provider.constructor.name;
    const cacheKey = `product-search:${providerName}:${searchQuery}:${JSON.stringify(providerOptions)}`;
    try {
      const request = wrap(cacheKey, SEARCH_CACHE_TTL_MS, () => {
        const timeout = AbortSignal.timeout(provider === rapidApiProvider ? PRODUCT_SEARCH_TIMEOUT_MS
          : provider === amazonProvider || provider === flipkartProvider ? RETAILER_SEARCH_TIMEOUT_MS : PROVIDER_TIMEOUT_MS);
        return provider.search(searchQuery, { ...providerOptions, signal: timeout });
      });
      const results = await waitForSharedSearch(request, signal);
      completed = true;
      const eligible = results.flatMap((result) => {
        if (!result.name || result.category !== opts.category) return [];
        const title = result._rawTitle ?? result.name;
        if (!isWholeProductListing(title, opts.category) || NON_NEW_TITLE.test(title)) return [];
        if (model && !matchesShoppingModel(title, modelName, modelBrand)) return [];
        const sellers = indianOffers((result.sellers || []).filter((offer) =>
          offer.price >= (budget?.min ?? 0) &&
          offer.price <= (budget?.max ?? Infinity)
        ));
        const approved = retailers ? sellers.filter(({ platform }) => retailers.includes(platform)) : sellers;
        return approved.length ? [{ ...result, sellers: approved }] : [];
      });
      const preferred = preferredMinPrice == null
        ? eligible
        : eligible.filter((result) => result.sellers.every((offer) => offer.price >= preferredMinPrice));
      if (eligible.length) return (preferred.length ? preferred : eligible).slice(0, limit);
      console.log(`[SEARCH] ${providerName}: no eligible model offers, trying the next source for the same model`);
    } catch (err) {
      if (signal?.aborted) break;
      console.warn(`[SEARCH] ${providerName} failed, trying next provider: ${err.message}`);
    }
  }

  if (completed) return [];
  throw new ApiError(503, "Live shopping search is temporarily unavailable. Please try again later.");
}
