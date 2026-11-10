import { env } from "../../config/env.js";
import { googleShoppingListing, indianListingKey, indianOffers } from "../../utils/indianRetailers.js";
import { parseInrPrice } from "../../utils/normalization.js";
import { get, set } from "../cache.service.js";
import { fetchRapidApiShopping } from "./rapidApiShopping.js";
import { RapidApiProductProvider } from "./RapidApiProductProvider.js";

const PRICE_HISTORY_URL = "https://real-time-product-search.p.rapidapi.com/product-price-history-v2";
const HISTORY_CACHE_MS = 24 * 60 * 60 * 1000;
const HISTORY_TIMEOUT_MS = 8000;
const productSearch = new RapidApiProductProvider();
const pending = new Map();

function inrHistoryPrice(point, offer) {
  const currency = point?.currency ?? offer.currency;
  const value = point?.price;
  if (currency == null) {
    if (typeof value !== "string" || !/^(?:₹|INR(?=\s|\d)|Rs\.?(?=\s|\d))/i.test(value.trim())) return null;
  } else if (!/^(?:INR|₹)$/i.test(currency)) {
    return null;
  }
  return parseInrPrice(value);
}

function normalizedTitle(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function resolveHistoryId(product, listingKeys) {
  const results = await productSearch.search(product.name, { limit: 10, signal: AbortSignal.timeout(HISTORY_TIMEOUT_MS) });
  const candidates = results.filter(({ shoppingHistoryId }) => shoppingHistoryId);
  const exactListing = candidates.find(({ sellers }) => sellers.some((offer) => listingKeys.has(indianListingKey(offer))));
  // Search can return a Google product page without a direct seller link.
  // Use an exact title to look up history, then verify its retailer links.
  const match = exactListing ?? candidates.find(({ name }) => normalizedTitle(name) === normalizedTitle(product.name));
  return match?.shoppingHistoryId;
}

async function fetchHistory(productId, listingKeys, googleListings) {
  if (!productId) return [];
  const url = new URL(PRICE_HISTORY_URL);
  url.search = new URLSearchParams({ product_id: productId, page: "1", country: "in", language: "en" });
  const response = await fetchRapidApiShopping(url, { signal: AbortSignal.timeout(HISTORY_TIMEOUT_MS) });
  if (response.status === 400 || response.status === 404) return [];
  if (!response.ok) throw new Error(`Real-Time Product Search price history failed (${response.status})`);

  const payload = await response.json();
  const offers = payload?.data?.offers;
  if (payload?.status !== "OK" || !Array.isArray(offers)) throw new Error("Real-Time Product Search returned invalid price history");

  const lowestByDate = new Map();
  for (const offer of offers) {
    if (!Array.isArray(offer?.price_history) || !/^new$/i.test(offer.product_condition ?? "")) continue;
    const [seller] = indianOffers([{ url: offer.offer_page_url, platform: offer.store_name, price: 1, currency: "INR" }]);
    const listingKey = seller && indianListingKey(seller);
    if (!listingKey) continue;
    if (!listingKeys.has(listingKey)
      && !googleListings.some(({ offerId, platform }) => offerId === offer.offer_id && platform === seller.platform)) continue;
    for (const point of offer.price_history) {
      const date = point?.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const parsedDate = new Date(date);
      if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) continue;

      const price = inrHistoryPrice(point, offer);
      if (price == null || price >= (lowestByDate.get(date)?.price ?? Infinity)) continue;
      lowestByDate.set(date, { platform: seller.platform, price, timestamp: date, source: "rapidapi" });
    }
  }
  return [...lowestByDate.values()];
}

async function lookupHistory(product, listingKeys, googleListings) {
  const knownId = product.shoppingHistoryId ?? googleListings[0]?.productId;
  if (knownId) return fetchHistory(knownId, listingKeys, googleListings);

  if (product.source === "serpapi" && /^\d{1,24}$/.test(product.sourceProductId ?? "")) {
    const history = await fetchHistory(`catalogid:${product.sourceProductId}`, listingKeys, googleListings);
    if (history.length) return history;
  }
  const matchedId = await resolveHistoryId(product, listingKeys);
  return fetchHistory(matchedId, listingKeys, googleListings);
}

export async function getRapidApiPriceHistory(product) {
  if (!env.rapidApi.key || !["serpapi", "rapidapi"].includes(product.source)) return [];

  const sellers = indianOffers(product.sellers);
  const listingKeys = new Set(sellers.map(indianListingKey).filter(Boolean));
  const googleListings = sellers.map(googleShoppingListing).filter(Boolean);
  if (!listingKeys.size && !googleListings.length) return [];
  const cacheKey = `rapidapi-price-history:${JSON.stringify([
    product.shoppingHistoryId ?? product.sourceProductId ?? product.name, [...listingKeys].sort(), googleListings,
  ])}`;
  const cached = get(cacheKey);
  if (cached !== undefined) return cached;
  if (pending.has(cacheKey)) return pending.get(cacheKey);

  const request = lookupHistory(product, listingKeys, googleListings).then((entries) => {
    set(cacheKey, entries, HISTORY_CACHE_MS);
    return entries;
  }).finally(() => pending.delete(cacheKey));
  pending.set(cacheKey, request);
  return request;
}
