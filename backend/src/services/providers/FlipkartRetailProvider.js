import { env } from "../../config/env.js";
import { parseInrPrice } from "../../utils/normalization.js";
import { fetchRapidApiShopping } from "./rapidApiShopping.js";
import { isNewAvailableListing } from "./ProductProvider.js";
import { indianListingKey } from "../../utils/indianRetailers.js";

function field(object, path) {
  return path?.split(".").reduce((value, key) => Object.hasOwn(value ?? {}, key) ? value[key] : undefined, object);
}

async function fetchFlipkartListings(query, { signal } = {}) {
  if (!env.rapidApi.flipkartSearchConfig) return [];
  if (!env.rapidApi.key) throw new Error("Flipkart search requires RAPIDAPI_KEY");

  let config;
  try {
    config = JSON.parse(env.rapidApi.flipkartSearchConfig);
  } catch {
    throw new Error("Invalid FLIPKART_SEARCH_CONFIG JSON");
  }
  const url = URL.parse(config?.url ?? "");
  if (!url || url.protocol !== "https:" || url.username || url.password || url.port
    || !/^[a-z0-9-]*flipkart[a-z0-9-]*\.p\.rapidapi\.com$/.test(url.hostname)
    || !["queryParam", "name", "price", "link"].every((key) => typeof config[key] === "string" && config[key])) {
    throw new Error("Invalid FLIPKART_SEARCH_CONFIG");
  }

  url.searchParams.set(config.queryParam, query);
  const response = await fetchRapidApiShopping(url, { signal });
  if (!response.ok) throw new Error(`Flipkart search failed (${response.status})`);
  const payload = await response.json();
  const rows = config.results ? field(payload, config.results) : payload;
  if (!Array.isArray(rows)) throw new Error("Flipkart search returned an unexpected response");

  return rows.flatMap((row) => {
    const name = field(row, config.name);
    const price = parseInrPrice(field(row, config.price));
    const link = URL.parse(field(row, config.link) ?? "");
    const currency = field(row, config.currency);
    const availability = config.availability ? field(row, config.availability)
      : row.product_availability ?? row.availability ?? row.in_stock;
    const condition = config.condition ? field(row, config.condition)
      : row.product_condition ?? row.second_hand_condition ?? row.condition;
    if (typeof name !== "string" || !name.trim() || price == null || !link
      || link.protocol !== "https:" || link.username || link.password || link.port
      || !/^(?:(?:www|m)\.)?flipkart\.com$/.test(link.hostname) || !/\/p\/[^/]+/.test(link.pathname)
      || (currency && !/^(?:INR|₹)$/i.test(currency))
      || !isNewAvailableListing({ condition, availability })
      || /(?:^(?:false|0)$|out[ _-]*of[ _-]*stock|unavailable|sold[ _-]*out|not[ _-]*available)/i.test(availability ?? "")) return [];

    const seller = { platform: "Flipkart", price, currency: "INR", url: link.href,
      ...(availability != null && { availability: true }) };
    const rating = config.rating ? Number(field(row, config.rating)) : NaN;
    const image = field(row, config.image);
    return [{
      name: name.trim(), seller, condition,
      image: typeof image === "string" ? image : undefined,
      rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : undefined,
      sourceProductId: indianListingKey(seller),
    }];
  });
}

/** Preserve the existing retailer-quote return shape. */
export async function searchFlipkartOffers(query, options = {}) {
  return (await fetchFlipkartListings(query, options)).map(({ name, seller }) => ({ name, ...seller, availability: true }));
}

/** Map only metadata whose paths are configured for this subscribed API. */
export async function searchFlipkartProducts(query, { category, signal, limit = 15 } = {}) {
  const listings = await fetchFlipkartListings(query, { signal });
  return listings.slice(0, limit).map(({ name, seller, condition, image, rating, sourceProductId }) => ({
    name: name.slice(0, 120), _rawTitle: name, brand: name.split(/\s+/)[0], category,
    sellers: [seller], source: "rapidapi", sourceProductId,
    ...(condition != null && { condition }),
    ...(image && { image }),
    ...(rating != null && { rating }),
  }));
}
