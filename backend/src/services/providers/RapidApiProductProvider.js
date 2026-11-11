import { env } from "../../config/env.js";
import { fetchRapidApiShopping } from "./rapidApiShopping.js";
import { isNewAvailableListing, ProductProvider } from "./ProductProvider.js";
import { parseInrPrice } from "../../utils/normalization.js";

const BASE_URL = "https://real-time-product-search.p.rapidapi.com";

/**
 * Google Shopping discovery through Real-Time Product Search for India.
 */
export class RapidApiProductProvider extends ProductProvider {
  async search(query, { category, signal, limit = 20 } = {}) {
    if (!env.rapidApi.key) {
      throw new Error("RapidApiProductProvider requires RAPIDAPI_KEY to be configured");
    }

    const url = new URL(`${BASE_URL}/search`);
    url.searchParams.set("q", category ? `${query} ${category}` : query);
    url.searchParams.set("limit", String(Math.min(limit, 40)));
    url.searchParams.set("page", "1");
    url.searchParams.set("country", "in");
    url.searchParams.set("language", "en");
    url.searchParams.set("sort_by", "BEST_MATCH");
    url.searchParams.set("product_condition", "NEW");
    url.searchParams.set("return_filters", "false");

    const response = await fetchRapidApiShopping(url, { signal });

    if (!response.ok) {
      throw new Error(`RapidAPI product search failed (${response.status})`);
    }

    const json = await response.json();
    if (json?.status === "ERROR" || !Array.isArray(json?.data?.products)) {
      throw new Error("Real-Time Product Search returned invalid product data");
    }
    return json.data.products.flatMap((product) => {
      if (!isNewAvailableListing(product)) return [];
      const offers = [
        { ...product, ...product.offer, offer_page_url: product.offer?.offer_page_url || product.product_page_url || product.product_url },
        ...(Array.isArray(product.offers) ? product.offers : []),
      ];
      return offers.flatMap((offer) => {
        if (!offer || !isNewAvailableListing(offer)) return [];
        const name = offer.offer_title || product.product_title;
        const price = parseInrPrice(offer.price);
        const currency = offer.currency ?? product.currency;
        if (currency && !/^(?:INR|₹)$/i.test(currency)) return [];
        if (!name || price == null || !offer.offer_page_url) return [];

        return [{
          name: name.slice(0, 120),
          _rawTitle: name,
          brand: name.split(" ")[0],
          category: category || "smartphone",
          sellers: [{
            platform: offer.store_name || "Online retailer",
            price,
            currency: "INR",
            url: offer.offer_page_url,
            availability: true,
          }],
          image: product.product_photos?.[0],
          rating: product.product_rating,
          source: "rapidapi",
          sourceProductId: product.product_id,
          shoppingHistoryId: typeof product.product_id === "string" ? product.product_id : undefined,
        }];
      });
    }).slice(0, limit);
  }
}
