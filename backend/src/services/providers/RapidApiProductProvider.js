import { env } from "../../config/env.js";
import { fetchRapidApiShopping } from "./rapidApiShopping.js";
import { ProductProvider } from "./ProductProvider.js";
import { parseInrPrice } from "../../utils/normalization.js";

const BASE_URL = "https://real-time-product-search.p.rapidapi.com";

/**
 * Live product search via RapidAPI's "Real-Time Product Search" API — search
 * results aggregated from real retailers (Amazon, eBay, Walmart, Best Buy,
 * Target, and others), reached through a legitimate subscribed API, not
 * scraping. Only active when RAPIDAPI_KEY is configured and USE_MOCK_DATA is
 * false; otherwise the search service falls back to MockProductProvider.
 *
 * Every field below is taken directly from the provider response. If a
 * result has no real product URL, it's dropped rather than given a
 * fabricated one — the spec is explicit that seller URLs must never be
 * invented.
 */
export class RapidApiProductProvider extends ProductProvider {
  async search(query, { category, signal, limit = 20 } = {}) {
    if (!env.rapidApi.key) {
      throw new Error("RapidApiProductProvider requires RAPIDAPI_KEY to be configured");
    }

    const url = new URL(`${BASE_URL}/search`);
    url.searchParams.set("q", category ? `${query} ${category}` : query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("page", "1");
    url.searchParams.set("country", "in");
    url.searchParams.set("language", "en");
    url.searchParams.set("sort_by", "BEST_MATCH");
    url.searchParams.set("product_condition", "ANY");
    url.searchParams.set("return_filters", "false");

    const response = await fetchRapidApiShopping(url, { signal });

    if (!response.ok) {
      throw new Error(`RapidAPI product search failed (${response.status})`);
    }

    const json = await response.json();
    const results = json?.data?.products || [];

    return results
      .map((r) => {
        const offer = r.offer;
        const price = parseInrPrice(offer?.price ?? r.price);
        const productUrl = offer?.offer_page_url || r.product_page_url || r.product_url;
        const currency = offer?.currency ?? r.currency;
        if (currency && !/^(?:INR|₹)$/i.test(currency)) return null;
        if (!r.product_title || price == null || !productUrl) return null;

        return {
          name: r.product_title.slice(0, 120),
          brand: r.product_title.split(" ")[0],
          category: category || "smartphone",
          sellers: [
            {
              platform: offer?.store_name || r.store_name || "Online retailer",
              price,
              currency: "INR",
              url: productUrl,
              availability: (offer?.in_stock ?? r.in_stock) !== false,
            },
          ],
          image: r.product_photos?.[0],
          rating: r.product_rating,
          source: "rapidapi",
          sourceProductId: r.product_id,
        };
      })
      .filter(Boolean)
      .slice(0, limit);
  }
}
