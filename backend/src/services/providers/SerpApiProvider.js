import { env } from "../../config/env.js";
import { isNewAvailableListing, ProductProvider } from "./ProductProvider.js";
import { parseInrPrice } from "../../utils/normalization.js";

const BASE_URL = "https://serpapi.com/search.json";
const rateLimitedUntil = new Map();
let nextKey = 0;

function serpApiKeys() {
  return [...new Set([env.serpApi.key, env.serpApi.key2].map((key) => key?.trim()).filter(Boolean))];
}

function markKeyLimited(key, error = "") {
  const delay = /run out of searches|monthly search limit|searches per month/i.test(error)
    ? 60 * 60_000
    : 60_000;
  rateLimitedUntil.set(key, Date.now() + delay);
}

export async function fetchSerpApiJson(url, { signal } = {}) {
  const keys = serpApiKeys();
  if (!keys.length) throw new Error("SerpApi requires SERPAPI_KEY to be configured");
  const attempted = new Set();
  let lastError;
  while (attempted.size < keys.length) {
    signal?.throwIfAborted();
    const now = Date.now();
    const available = keys.map((key, index) => ({ key, index }))
      .filter(({ key }) => !attempted.has(key) && (rateLimitedUntil.get(key) ?? 0) <= now);
    if (!available.length) {
      if (attempted.size) break;
      throw new Error("All SerpApi keys are temporarily rate limited");
    }
    const selected = available.find(({ index }) => index >= nextKey) ?? available[0];
    attempted.add(selected.key);
    nextKey = (selected.index + 1) % keys.length;
    const requestUrl = new URL(url);
    requestUrl.searchParams.set("api_key", selected.key);
    const response = await fetch(requestUrl, { signal });
    if (response.status === 429) {
      const payload = await response.json().catch(() => ({}));
      markKeyLimited(selected.key, payload?.error ?? "");
      lastError = new Error("SerpApi key rate or monthly quota limit reached");
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      markKeyLimited(selected.key, "invalid key or endpoint access");
      lastError = new Error("SerpApi key was rejected or lacks access");
      continue;
    }
    if (!response.ok) throw new Error(`SerpApi request failed (${response.status})`);
    const json = await response.json();
    if (json?.error && /run out of searches|monthly search limit|searches per month/i.test(json.error)) {
      markKeyLimited(selected.key, json.error);
      lastError = new Error("SerpApi key monthly quota exhausted");
      continue;
    }
    if (json?.error && /invalid api key|api key is invalid/i.test(json.error)) {
      markKeyLimited(selected.key, "invalid key");
      lastError = new Error("SerpApi key was rejected");
      continue;
    }
    return json;
  }
  throw lastError ?? new Error("No available SerpApi key");
}

function extractBrand(title) {
  return String(title || "").split(/\s+/)[0] || "Unknown";
}

/**
 * Primary Google Shopping discovery for India.
 *
 * SerpApi conveniently returns both a display price string and an already-
 * parsed `extracted_price` number — we still run it through the shared
 * parseInrPrice() sanity floor rather than trusting it blindly, since a
 * malformed/misaligned field is still possible.
 */
export class SerpApiProvider extends ProductProvider {
  async search(query, { category, signal, limit = 15, exactModel = false } = {}) {
    if (!serpApiKeys().length) {
      throw new Error("SerpApiProvider requires SERPAPI_KEY to be configured");
    }
    const url = new URL(BASE_URL);
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", !exactModel && category ? `${query} ${category}` : query);
    url.searchParams.set("gl", "in");
    url.searchParams.set("hl", "en");
    url.searchParams.set("google_domain", "google.co.in");
    const json = await fetchSerpApiJson(url, { signal });
    if (typeof json.error === "string" && /hasn't returned any results/i.test(json.error)) return [];
    if (json.error) throw new Error("SerpApi returned an error for this search");

    const results = [
      ...(json.shopping_results ?? []),
      ...(json.categorized_shopping_results ?? []).flatMap(({ shopping_results }) => shopping_results ?? []),
    ];

    return results
      .map((r) => {
        if (!isNewAvailableListing(r) || (r.currency && !/^(?:INR|₹)$/i.test(r.currency))) return null;
        const price = parseInrPrice(r.price ?? r.extracted_price);
        const link = r.direct_link || r.link || r.product_link;
        if (!r.title || price == null || !link) return null;
        return {
          name: r.title.slice(0, 120),
          _rawTitle: r.title,
          brand: extractBrand(r.title),
          category: category || "smartphone",
          sellers: [{
            platform: r.source || "Google Shopping",
            price,
            currency: "INR",
            url: link,
            availability: true,
          }],
          image: r.thumbnail,
          rating: r.rating,
          source: "serpapi",
          sourceProductId: r.product_id,
        };
      })
      .filter(Boolean)
      .slice(0, limit);
  }
}
