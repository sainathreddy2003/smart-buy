import { env } from "../../config/env.js";
import { fetchRapidApiShopping } from "./rapidApiShopping.js";
import { ProductProvider } from "./ProductProvider.js";
import { parseInrPrice } from "../../utils/normalization.js";

function extractBrand(title) {
  return String(title || "").split(/\s+/)[0] || "Unknown";
}

/**
 * Google Search Master Shopping via either RapidAPI subscription.
 */
export class GoogleShoppingProvider extends ProductProvider {
  constructor({ mega = false } = {}) {
    super();
    this.host = mega ? "google-search-master-mega.p.rapidapi.com" : "google-search-master.p.rapidapi.com";
  }

  async search(query, { category, signal, limit = 15 } = {}) {
    if (!env.rapidApi.key) {
      throw new Error("GoogleShoppingProvider requires RAPIDAPI_KEY to be configured");
    }

    const url = new URL(`https://${this.host}/shopping`);
    url.searchParams.set("q", category ? `${query} ${category}` : query);
    url.searchParams.set("gl", "in");
    url.searchParams.set("hl", "en");
    url.searchParams.set("autocorrect", "true");
    url.searchParams.set("num", String(limit));
    url.searchParams.set("page", "1");

    const response = await fetchRapidApiShopping(url, { signal });

    if (!response.ok) {
      throw new Error(`Google Search Master request failed (${response.status})`);
    }

    const json = await response.json();
    if (!Array.isArray(json.shopping)) throw new Error("Google Search Master returned invalid shopping data");
    const results = json.shopping;

    return results
      .map((r) => {
        const price = parseInrPrice(r.price);
        if (!r.title || price == null || !r.link) return null;
        return {
          name: r.title.slice(0, 120),
          brand: extractBrand(r.title),
          category: category || "smartphone",
          sellers: [
            {
              platform: r.source || "Google Shopping",
              price,
              currency: "INR",
              url: r.link,
              availability: true,
            },
          ],
          image: r.imageUrl,
          rating: r.rating,
          source: "rapidapi",
          sourceProductId: r.productId,
        };
      })
      .filter(Boolean)
      .slice(0, limit);
  }
}
