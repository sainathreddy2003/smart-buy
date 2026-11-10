import { env } from "../../config/env.js";
import { parseInrPrice } from "../../utils/normalization.js";
import { fetchRapidApiShopping } from "./rapidApiShopping.js";

function field(object, path) {
  return path?.split(".").reduce((value, key) => Object.hasOwn(value ?? {}, key) ? value[key] : undefined, object);
}

export async function searchFlipkartOffers(query, { signal } = {}) {
  if (!env.rapidApi.flipkartSearchConfig) return [];

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
    const availability = field(row, config.availability);
    if (typeof name !== "string" || !name.trim() || price == null || !link
      || link.protocol !== "https:" || link.username || link.password || link.port
      || !/^(?:(?:www|m)\.)?flipkart\.com$/.test(link.hostname) || !/\/p\/[^/]+/.test(link.pathname)
      || (currency && !/^(?:INR|₹)$/i.test(currency))
      || availability === false || /^(?:false|0|out[ _-]of[ _-]stock|unavailable|sold[ _-]out)$/i.test(availability ?? "")) return [];

    return [{ name: name.trim(), platform: "Flipkart", price, currency: "INR", url: link.href, availability: true }];
  });
}
