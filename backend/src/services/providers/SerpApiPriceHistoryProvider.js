import { env } from "../../config/env.js";
import { indianRetailerName } from "../../utils/indianRetailers.js";
import { fetchSerpApiJson } from "./SerpApiProvider.js";
import { get, set } from "../cache.service.js";

const HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const pending = new Map();

function dateOnly(value) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function indiaStore(name) {
  const value = String(name ?? "").trim().toLowerCase();
  if (/\bamazon(?:\.in| india)?\b/.test(value)) return "Amazon India";
  if (/\bflipkart\b/.test(value)) return "Flipkart";
  if (/\bcroma\b/.test(value)) return "Croma";
  return indianRetailerName(name);
}

async function loadHistory(product) {
  if (!/^\d{1,24}$/.test(product.sourceProductId ?? "")) return [];
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_product");
  url.searchParams.set("product_id", product.sourceProductId);
  url.searchParams.set("offer_view", "true");
  url.searchParams.set("gl", "in");
  url.searchParams.set("hl", "en");
  const payload = await fetchSerpApiJson(url, { signal: AbortSignal.timeout(7000) });
  if (payload?.error) throw new Error("SerpApi Google Product returned an error");

  const insights = payload?.product_results?.price_insights;
  if (insights?.currency !== "INR" || !Array.isArray(insights?.stores)) return [];
  const now = Date.now();
  const from = now - HISTORY_WINDOW_MS;
  const byDate = new Map();
  for (const store of insights.stores) {
    const platform = indiaStore(store?.name);
    if (!platform || !Array.isArray(store.prices)) continue;
    for (const point of store.prices) {
      const date = dateOnly(point?.date);
      const price = Number(point?.price);
      if (!date || !Number.isFinite(price) || price <= 0) continue;
      const timestamp = Date.parse(`${date}T00:00:00+05:30`);
      if (timestamp < from || timestamp > now) continue;
      const current = byDate.get(date);
      if (!current || price < current.price) {
        byDate.set(date, { platform, price, timestamp: date, source: "serpapi" });
      }
    }
  }
  return [...byDate.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function getSerpApiPriceHistory(product) {
  if (!env.serpApi.key && !env.serpApi.key2) return [];
  if (product.source !== "serpapi" || !/^\d{1,24}$/.test(product.sourceProductId ?? "")) return [];
  const cacheKey = `serpapi-price-history:${product.sourceProductId}:in`;
  const cached = get(cacheKey);
  if (cached !== undefined) return cached;
  if (pending.has(cacheKey)) return pending.get(cacheKey);
  const request = loadHistory(product).then((entries) => {
    set(cacheKey, entries, CACHE_TTL_MS);
    return entries;
  }).finally(() => pending.delete(cacheKey));
  pending.set(cacheKey, request);
  return request;
}
