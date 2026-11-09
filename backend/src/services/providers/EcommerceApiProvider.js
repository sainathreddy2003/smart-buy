import { env } from "../../config/env.js";
import { ProductProvider } from "./ProductProvider.js";
import { parsePrice } from "../../utils/normalization.js";

const BASE_URL = "https://ecommerce-api3.p.rapidapi.com";
const HOST = "ecommerce-api3.p.rapidapi.com";

// This API has no per-query search — each endpoint returns its whole
// category listing (400+ items). We fetch it once (cached, see below) and
// rank client-side by how many of the query's significant words appear in
// the listing's title/description, rather than hitting the network per
// search. Only smartphone/laptop are covered by this provider's endpoints.
const CATEGORY_PATH = { smartphone: "/mobiles", laptop: "/laptops" };

const STOPWORDS = new Set(["for", "the", "a", "an", "with", "under", "and", "of", "to", "in", "my"]);

function extractBrand(title) {
  return String(title || "").split(/\s+/)[0] || "Unknown";
}

function cleanName(title) {
  let name = title;
  const cuts = [name.indexOf(" - ("), name.indexOf(" ("), name.indexOf("|")].filter((i) => i >= 0);
  if (cuts.length) name = name.slice(0, Math.min(...cuts));
  name = name.trim();
  return name.length > 70 ? name.slice(0, 70).replace(/\s+\S*$/, "") : name;
}

function relevanceScore(item, queryWords) {
  const haystack = `${item.Brand} ${item.Description}`.toLowerCase();
  return queryWords.reduce((score, w) => score + (haystack.includes(w) ? 1 : 0), 0);
}

/**
 * Fallback live provider backed by a bulk Flipkart listing dataset
 * (ecommerce-api3.p.rapidapi.com) — no per-query search, so we fetch the
 * category's full list (cached — see fetchCategoryOnce) and rank client-side
 * by keyword overlap with the query. Real listings, real prices/images;
 * ranking is a simple heuristic, not a real search engine.
 */
export class EcommerceApiProvider extends ProductProvider {
  constructor() {
    super();
    this._categoryCache = new Map(); // category -> {data, fetchedAt}
  }

  async _fetchCategoryOnce(category) {
    const path = CATEGORY_PATH[category];
    if (!path) return [];

    const cached = this._categoryCache.get(category);
    if (cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000) return cached.data;

    if (!env.rapidApi.key) throw new Error("EcommerceApiProvider requires RAPIDAPI_KEY");

    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "x-rapidapi-key": env.rapidApi.key, "x-rapidapi-host": HOST },
    });
    if (!res.ok) throw new Error(`Ecommerce API request failed (${res.status})`);

    const data = await res.json();
    this._categoryCache.set(category, { data, fetchedAt: Date.now() });
    return data;
  }

  async search(query, { category, limit = 15 } = {}) {
    if (!category || !CATEGORY_PATH[category]) return [];

    const items = await this._fetchCategoryOnce(category);
    const queryWords = String(query || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));

    const ranked = items
      .map((item) => ({ item, score: queryWords.length ? relevanceScore(item, queryWords) : 1 }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return ranked
      .map(({ item }) => {
        const price = parsePrice(item.Price);
        const name = cleanName(item.Brand);
        if (!price || !name || !item.Image) return null;
        return {
          name,
          brand: extractBrand(item.Brand),
          category,
          sellers: [{ platform: "Flipkart", price, currency: "INR", url: `https://www.flipkart.com/search?q=${encodeURIComponent(name)}`, availability: true }],
          image: item.Image,
          rating: undefined,
          source: "rapidapi",
          sourceProductId: undefined,
          _rawTitle: item.Brand,
          _rawDescription: item.Description,
        };
      })
      .filter(Boolean);
  }
}
