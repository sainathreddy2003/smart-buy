import { env } from "../../config/env.js";
import { parseInrPrice } from "../../utils/normalization.js";
import { fetchRapidApiShopping } from "./rapidApiShopping.js";

const SEARCH_URL = "https://real-time-amazon-data.p.rapidapi.com/search";

export async function searchAmazonOffers(query, { signal } = {}) {
  if (!env.rapidApi.key) throw new Error("Amazon India search requires RAPIDAPI_KEY");

  const url = new URL(SEARCH_URL);
  url.search = new URLSearchParams({ query, country: "IN", page: "1" });
  const response = await fetchRapidApiShopping(url, { signal });
  if (!response.ok) throw new Error(`Amazon India search failed (${response.status})`);

  const payload = await response.json();
  const products = payload?.data?.products;
  if (payload?.status === "ERROR" || !Array.isArray(products)) {
    throw new Error("Amazon India search returned invalid product data");
  }

  return products.flatMap((product) => {
    if (typeof product?.product_title !== "string" || !product.product_title.trim()) return [];
    const name = product.product_title.trim();
    const price = parseInrPrice(product.product_price);
    const link = URL.parse(product.product_url ?? "");
    if (price == null || !link) return [];
    if (product.currency && !/^(?:INR|₹)$/i.test(product.currency)) return [];
    if (link.protocol !== "https:" || link.username || link.password || link.port
      || !/^(?:(?:www|m)\.)?amazon\.in$/.test(link.hostname)
      || !/\/(?:dp|gp\/product)\/[a-z0-9]{10}(?:\/|$)/i.test(link.pathname)) return [];
    if (product.product_availability === false || /\b(?:out of stock|unavailable)\b/i.test(product.product_availability ?? "")) return [];

    return [{ name, platform: "Amazon India", price, currency: "INR", url: link.href, availability: true }];
  });
}
