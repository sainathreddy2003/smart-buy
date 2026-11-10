import { indianOffers } from "../utils/indianRetailers.js";
import { wrap } from "./cache.service.js";
import { searchAmazonOffers } from "./providers/AmazonRetailProvider.js";
import { searchFlipkartOffers } from "./providers/FlipkartRetailProvider.js";

const QUOTE_TTL_MS = 5 * 60 * 1000;
const QUOTE_TIMEOUT_MS = 8000;
const NON_NEW_PRODUCT = /\b(?:refurbished|renewed|pre[- ]owned|second[- ]hand|open[- ]box|used)\b/i;
const ACCESSORY = /\b(?:case|cover|protector|charger|sleeve|strap|compatible)\b.*\b(?:for|with)\b/i;
const GENERIC = new Set(["smartphone", "phone", "mobile", "laptop", "tablet", "ram", "storage", "memory", "ssd", "gb", "tb"]);
const VARIANT = /^(?:pro|plus|max|ultra|mini|lite|air|fe|se|edge|xl)$/;
const CONFIGURATION = /^(?:\d+(?:gb|mm|inch|th|g)|[im][1-9]|\d{3,}[a-z]{0,3}|[a-z]+\d{3,}[a-z0-9]*)$/;

function productTokens(name) {
  return new Set(name.toLowerCase()
    .replace(/\b(\d+)\s*(tb|gb)\b/g, (_, size, unit) => `${Number(size) * (unit === "tb" ? 1024 : 1)}gb`)
    .replace(/\b(\d+)\s*(mm|inch(?:es)?)\b/g, (_, size, unit) => `${size}${unit === "mm" ? "mm" : "inch"}`)
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter((word) => word && !GENERIC.has(word)));
}

function configuration(tokens) {
  return [...tokens].filter((token) => CONFIGURATION.test(token)).sort().join(",");
}

function matchesProduct(product, name) {
  if (NON_NEW_PRODUCT.test(name) || ACCESSORY.test(name)) return false;
  const title = productTokens(name);
  return product.size >= 2 && [...product].every((token) => title.has(token))
    && ![...title].some((token) => VARIANT.test(token) && !product.has(token));
}

async function retailerQuotes(search, platform, product, budget) {
  const title = productTokens(product.name);
  try {
    const quotes = await wrap(`retailer-quotes:${platform}:${product.name.toLowerCase()}`, QUOTE_TTL_MS,
      () => search(product.name, { signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS) }));
    return quotes.filter((quote) => typeof quote.name === "string" && quote.platform === platform
      && quote.price >= (budget?.min ?? 0) && quote.price <= (budget?.max ?? Infinity)
      && matchesProduct(title, quote.name) && indianOffers([quote]).length)
      .sort((a, b) => a.price - b.price);
  } catch (err) {
    console.warn(`[RETAIL] ${platform} quote lookup failed: ${err.message}`);
    return [];
  }
}

export async function verifyRetailerPrices(product, budget) {
  const [amazon, flipkart] = await Promise.all([
    retailerQuotes(searchAmazonOffers, "Amazon India", product, budget),
    retailerQuotes(searchFlipkartOffers, "Flipkart", product, budget),
  ]);

  const cheapestFirst = [...amazon, ...flipkart].sort((a, b) => a.price - b.price);
  for (const first of cheapestFirst) {
    const otherStore = first.platform === "Amazon India" ? flipkart : amazon;
    const variant = configuration(productTokens(first.name));
    if (["smartphone", "laptop"].includes(product.category) && !variant.includes("gb")) continue;
    const second = otherStore.find((quote) => configuration(productTokens(quote.name)) === variant);
    if (second) return indianOffers([first, second]).map(({ name, ...seller }) => seller);
  }
  return indianOffers(cheapestFirst.slice(0, 1)).map(({ name, ...seller }) => seller);
}
