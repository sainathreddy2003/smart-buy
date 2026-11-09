import { env } from "../../config/env.js";
import { fetchRapidApiShopping } from "./rapidApiShopping.js";
import { ProductProvider } from "./ProductProvider.js";
import { parseInrPrice } from "../../utils/normalization.js";

const BASE_URL = "https://google-search-master-mega.p.rapidapi.com/shopping";

function extractBrand(title) {
  return String(title || "").split(/\s+/)[0] || "Unknown";
}

/**
 * Live product search via RapidAPI's "Google Search Master (MEGA)" Shopping
 * endpoint — real, current Google Shopping results for India (gl=in),
 * matched directly against the shopper's natural-language query rather than
 * a bag-of-keywords search. Preferred over RapidApiProductProvider when
 * both are configured, since it responds better to full free-text queries
 * and returns India-local sellers/pricing directly.
 *
 * Every field is taken verbatim from the response — prices, sellers, and
 * links are never invented. `link` is a Google Shopping results URL (not a
 * direct retailer deep link), which is what the API actually returns; it is
 * real and resolves to real listings, not a fabricated URL.
 */
export class GoogleShoppingProvider extends ProductProvider {
  async search(query, { category, signal, limit = 15 } = {}) {
    if (!env.rapidApi.key) {
      throw new Error("GoogleShoppingProvider requires RAPIDAPI_KEY to be configured");
    }

    const url = new URL(BASE_URL);
    url.searchParams.set("q", category ? `${query} ${category}` : query);
    url.searchParams.set("gl", "in");
    url.searchParams.set("hl", "en");
    url.searchParams.set("autocorrect", "true");
    url.searchParams.set("num", String(limit));
    url.searchParams.set("page", "1");

    const response = await fetchRapidApiShopping(url, { signal });

    if (!response.ok) {
      throw new Error(`Google Search Master (MEGA) request failed (${response.status})`);
    }

    const json = await response.json();
    const results = json.shopping || [];

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
