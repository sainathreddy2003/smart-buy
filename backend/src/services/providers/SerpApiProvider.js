import { env } from "../../config/env.js";
import { ProductProvider } from "./ProductProvider.js";
import { parseInrPrice } from "../../utils/normalization.js";

const BASE_URL = "https://serpapi.com/search.json";

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
  #rateLimitedUntil = 0;

  async search(query, { category, signal, limit = 15 } = {}) {
    if (!env.serpApi.key) {
      throw new Error("SerpApiProvider requires SERPAPI_KEY to be configured");
    }

    if (Date.now() < this.#rateLimitedUntil) throw new Error("SerpApi rate limit cooldown");

    const url = new URL(BASE_URL);
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", category ? `${query} ${category}` : query);
    url.searchParams.set("api_key", env.serpApi.key);
    url.searchParams.set("gl", "in");
    url.searchParams.set("hl", "en");
    url.searchParams.set("google_domain", "google.co.in");

    const response = await fetch(url, { signal });
    if (response.status === 429) {
      const { error } = await response.json().catch(() => ({}));
      const delay = /run out of searches/i.test(error ?? "") ? 60 * 60_000 : 60_000;
      this.#rateLimitedUntil = Date.now() + delay;
    }
    if (!response.ok) {
      throw new Error(`SerpApi request failed (${response.status})`);
    }

    const json = await response.json();
    if (typeof json.error === "string" && /hasn't returned any results/i.test(json.error)) return [];
    if (json.error) throw new Error("SerpApi returned an error for this search");

    const results = json.shopping_results || [];

    return results
      .map((r) => {
        const price = parseInrPrice(r.price ?? r.extracted_price);
        const link = r.direct_link || r.link || r.product_link;
        if (!r.title || price == null || !link) return null;
        return {
          name: r.title.slice(0, 120),
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
