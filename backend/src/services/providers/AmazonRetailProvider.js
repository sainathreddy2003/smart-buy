import { env } from "../../config/env.js";
import { parseInrPrice } from "../../utils/normalization.js";
import { fetchRapidApiShopping } from "./rapidApiShopping.js";
import { isNewAvailableListing } from "./ProductProvider.js";

const SEARCH_URL = "https://real-time-amazon-data.p.rapidapi.com/search";

async function fetchAmazonListings(query, { signal } = {}) {
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
    const availability = product.product_availability ?? product.availability;
    if (!isNewAvailableListing({ ...product, availability })
      || /(?:out[ _-]*of[ _-]*stock|unavailable|sold[ _-]*out|not[ _-]*available)/i.test(availability ?? "")) return [];
    const name = product.product_title.trim();
    const price = parseInrPrice(product.product_price);
    const link = URL.parse(product.product_url ?? "");
    if (price == null || !link) return [];
    if (product.currency && !/^(?:INR|₹)$/i.test(product.currency)) return [];
    if (link.protocol !== "https:" || link.username || link.password || link.port
      || !/^(?:(?:www|m)\.)?amazon\.in$/.test(link.hostname)
      || !/\/(?:dp|gp\/product)\/[a-z0-9]{10}(?:\/|$)/i.test(link.pathname)) return [];
    const asin = link.pathname.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})(?:\/|$)/i)?.[1].toUpperCase();
    const rating = Number(product.product_star_rating);
    return [{
      name,
      seller: { platform: "Amazon India", price, currency: "INR", url: link.href, availability: true },
      sourceProductId: asin,
      condition: product.product_condition ?? product.second_hand_condition ?? product.condition,
      image: typeof product.product_photo === "string" ? product.product_photo : undefined,
      rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : undefined,
    }];
  });
}

/** Legacy quote contract; a search still consumes only one provider request. */
export async function searchAmazonOffers(query, options = {}) {
  return (await fetchAmazonListings(query, options)).map(({ name, seller }) => ({ name, ...seller }));
}

/** Native model-search fallback with the same normalized shape as Shopping. */
export async function searchAmazonProducts(query, { category, signal, limit = 15 } = {}) {
  const listings = await fetchAmazonListings(query, { signal });
  return listings.slice(0, limit).map(({ name, seller, sourceProductId, image, rating, condition }) => ({
    name: name.slice(0, 120),
    _rawTitle: name,
    brand: name.split(/\s+/)[0],
    category,
    sellers: [seller],
    image,
    rating,
    source: "rapidapi",
    sourceProductId,
    ...(condition != null && { condition }),
  }));
}
