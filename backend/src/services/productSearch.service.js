import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { indianOffers } from "../utils/indianRetailers.js";
import { GoogleShoppingProvider } from "./providers/GoogleShoppingProvider.js";
import { RapidApiProductProvider } from "./providers/RapidApiProductProvider.js";
import { SerpApiProvider } from "./providers/SerpApiProvider.js";
import { wrap } from "./cache.service.js";

const serpApiProvider = new SerpApiProvider();
const rapidApiProvider = new RapidApiProductProvider();
const googleMegaProvider = new GoogleShoppingProvider({ mega: true });
const googleShoppingProvider = new GoogleShoppingProvider();

const LIVE_PROVIDERS = [serpApiProvider, rapidApiProvider, googleMegaProvider, googleShoppingProvider];
const PROVIDER_TIMEOUT_MS = 3200;
const PRODUCT_SEARCH_TIMEOUT_MS = 5000;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const ACCESSORY_TITLE = /\b(?:case for|cover for|screen protector|tempered glass|replacement (?:screen|battery)|charger for|sleeve for|strap for)\b/i;
const DEVICE_ACCESSORY_SUFFIX = /\b(?:case|cover|charger|sleeve|protector)\s*$/i;
const NON_NEW_TITLE = /\b(?:refurbished|renewed|pre[- ]owned|second[- ]hand|open[- ]box|used)\b/i;
const MODEL_SUFFIX = /^(?:pro|max|plus|ultra|mini|lite|fe|se|xl|power)\b/;

function normalizedTitle(title) {
  return ` ${title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function matchesModel(title, model, brand) {
  const name = normalizedTitle(title);
  const withoutBrand = brand && model.length > brand.length && model.startsWith(brand) ? ` ${model.slice(brand.length)}` : model;
  const index = name.indexOf(withoutBrand);
  return index >= 0 && !MODEL_SUFFIX.test(name.slice(index + withoutBrand.length));
}

export function matchesShoppingModel(title, modelName, modelBrand) {
  return matchesModel(title, normalizedTitle(modelName), modelBrand && normalizedTitle(modelBrand));
}

export function isLiveModeActive() {
  return !env.useMockData && Boolean(env.serpApi.key || env.rapidApi.key);
}

export async function searchProducts(query, { budget, modelName, modelBrand, preferredMinPrice, retailers, signal, limit = 15, ...opts } = {}) {
  if (!isLiveModeActive()) return [];

  const model = modelName && normalizedTitle(modelName);
  const brand = modelBrand && normalizedTitle(modelBrand);
  // Look beyond the first few listings before filtering by budget and seller.
  const providerOptions = { ...opts, limit: Math.max(limit, 15) };
  for (const provider of LIVE_PROVIDERS) {
    if (signal?.aborted) break;
    const key = provider === serpApiProvider ? env.serpApi.key : env.rapidApi.key;
    if (!key) continue;
    const providerName = provider.host ?? provider.constructor.name;
    const cacheKey = `product-search:${providerName}:${query}:${JSON.stringify(providerOptions)}`;
    try {
      const results = await wrap(cacheKey, SEARCH_CACHE_TTL_MS, () => {
        const timeout = AbortSignal.timeout(provider === rapidApiProvider ? PRODUCT_SEARCH_TIMEOUT_MS : PROVIDER_TIMEOUT_MS);
        return provider.search(query, { ...providerOptions, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      });
      const eligible = results.flatMap((result) => {
        if (!result.name || result.category !== opts.category) return [];
        const title = result._rawTitle ?? result.name;
        if (ACCESSORY_TITLE.test(title) || NON_NEW_TITLE.test(title)) return [];
        if (["smartphone", "laptop"].includes(opts.category) && DEVICE_ACCESSORY_SUFFIX.test(title)) return [];
        if (model && !matchesModel(result.name, model, brand)) return [];
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
      return (preferred.length ? preferred : eligible).slice(0, limit);
    } catch (err) {
      console.warn(`[SEARCH] ${providerName} failed, trying next provider: ${err.message}`);
    }
  }

  throw new ApiError(503, "Live shopping search is temporarily unavailable. Please try again later.");
}
