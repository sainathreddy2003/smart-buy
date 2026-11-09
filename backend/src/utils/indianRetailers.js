const DOMAIN_RETAILERS = new Map([
  ["amazon.in", "Amazon India"],
  ["flipkart.com", "Flipkart"],
  ["croma.com", "Croma"],
]);

const RETAILER_NAMES = new Map([
  ...DOMAIN_RETAILERS,
  ["amazon india", "Amazon India"],
  ["flipkart", "Flipkart"],
  ["croma", "Croma"],
]);

export function indianRetailerName(name) {
  if (typeof name === "string") return RETAILER_NAMES.get(name.trim().toLowerCase().replace(/^www\./, ""));
}

function retailerForOffer({ url, platform }) {
  const link = URL.parse(url ?? "");
  if (!link || !["https:", "http:"].includes(link.protocol) || link.username || link.password || link.port) return;
  const host = link.hostname.replace(/^www\./, "");
  const directRetailer = DOMAIN_RETAILERS.get(host);
  if (directRetailer) return directRetailer;

  // Shopping results sometimes link to Google's product page instead of the
  // retailer. In that case require the API's explicit Indian seller label.
  const region = link.searchParams.get("gl");
  if (["google.com", "google.co.in"].includes(host)
    && /^\/shopping\/product\/\d+\/?$/.test(link.pathname)
    && (!region || region.toLowerCase() === "in")) {
    return indianRetailerName(platform);
  }
}

export function indianOffers(offers = []) {
  const byRetailer = new Map();
  for (const offer of offers) {
    if (offer.currency !== "INR" || offer.availability === false || !Number.isFinite(offer.price) || offer.price <= 0) continue;
    const retailer = retailerForOffer(offer);
    if (!retailer || offer.price >= (byRetailer.get(retailer)?.price ?? Infinity)) continue;
    byRetailer.set(retailer, { ...(offer.toObject?.() ?? offer), platform: retailer });
  }
  return [...byRetailer.values()].sort((a, b) => a.price - b.price);
}

export function withIndianOffers(product, offers = product.sellers) {
  const sellers = indianOffers(offers);
  return { ...product, sellers, bestPrice: sellers[0]?.price ?? null };
}
