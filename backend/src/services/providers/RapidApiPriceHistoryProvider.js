import { env } from "../../config/env.js";
import { indianOffers } from "../../utils/indianRetailers.js";
import { parseInrPrice } from "../../utils/normalization.js";
import { get, set } from "../cache.service.js";
import { fetchRapidApiShopping } from "./rapidApiShopping.js";

const PRICE_HISTORY_URL = "https://real-time-product-search.p.rapidapi.com/product-price-history-v2";
const HISTORY_CACHE_MS = 24 * 60 * 60 * 1000;
const HISTORY_TIMEOUT_MS = 5000;
const INDIA_RETAILERS = new Set(["Amazon India", "Flipkart"]);
const INDIA_RETAILER_HOSTS = new Set(["amazon.in", "flipkart.com"]);
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

async function fetchHistory(productId) {
  const url = new URL(PRICE_HISTORY_URL);
  url.search = new URLSearchParams({ product_id: productId, page: "1", country: "in", language: "en" });
  const response = await fetchRapidApiShopping(url, { signal: AbortSignal.timeout(HISTORY_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Real-Time Product Search price history failed (${response.status})`);

  const payload = await response.json();
  const offers = payload?.data?.offers;
  if (payload?.status !== "OK" || !Array.isArray(offers)) throw new Error("Real-Time Product Search returned invalid price history");

  const lowestByDate = new Map();
  for (const offer of offers) {
    if (!Array.isArray(offer?.price_history) || !/^new$/i.test(offer.product_condition ?? "")) continue;
    for (const point of offer.price_history) {
      const date = point?.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const parsedDate = new Date(date);
      if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) continue;

      const price = inrHistoryPrice(point, offer);
      if (price == null || price >= (lowestByDate.get(date)?.price ?? Infinity)) continue;
      const [seller] = indianOffers([{ url: offer.offer_page_url, platform: offer.store_name, price, currency: "INR" }]);
      if (!seller || !INDIA_RETAILERS.has(seller.platform) || !INDIA_RETAILER_HOSTS.has(new URL(seller.url).hostname.replace(/^(?:www|m)\./, ""))) continue;

      lowestByDate.set(date, { platform: seller.platform, price, timestamp: date, source: "rapidapi" });
    }
  }
  return [...lowestByDate.values()];
}

export async function getRapidApiPriceHistory(productId) {
  if (!productId || !env.rapidApi.key) return [];

  const cacheKey = `rapidapi-price-history:${productId}`;
  const cached = get(cacheKey);
  if (cached !== undefined) return cached;
  if (pending.has(cacheKey)) return pending.get(cacheKey);

  const request = fetchHistory(productId).then((entries) => {
    set(cacheKey, entries, HISTORY_CACHE_MS);
    return entries;
  }).finally(() => pending.delete(cacheKey));
  pending.set(cacheKey, request);
  return request;
}
