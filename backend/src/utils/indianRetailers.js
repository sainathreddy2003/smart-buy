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

function parseOfferLink(url) {
  const link = URL.parse(url ?? "");
  if (link && ["https:", "http:"].includes(link.protocol) && !link.username && !link.password && !link.port) return link;
}

function directRetailer(link) {
  return link && DOMAIN_RETAILERS.get(link.hostname.replace(/^(?:www|m)\./, ""));
}

function resolveIndianOffer({ url, platform }) {
  const link = parseOfferLink(url);
  if (!link) return;
  const retailer = directRetailer(link);
  if (retailer) return { platform: retailer, url };

  const host = link.hostname.replace(/^www\./, "");
  if (!["google.com", "google.co.in"].includes(host)) return;
  const region = link.searchParams.get("gl")?.toLowerCase();
  if (region && region !== "in") return;

  if (link.pathname === "/url" || link.pathname === "/aclk") {
    const target = parseOfferLink(link.searchParams.get("adurl") || link.searchParams.get("url") || link.searchParams.get("q"));
    const targetRetailer = directRetailer(target);
    if (targetRetailer) return { platform: targetRetailer, url: target.href };
    return;
  }

  // Shopping results sometimes link to Google's product page instead of the
  // retailer. Require a specific product and a recognized seller label.
  const isProductPage = /^\/shopping\/product\/\d+\/?$/.test(link.pathname)
    || (link.pathname === "/search" && link.searchParams.get("ibp") === "oshop"
      && /(?:^|,)(?:catalogid|pid|productid|headlineOfferDocid):\d+(?:,|$)/i.test(link.searchParams.get("prds") ?? ""));
  if (!isProductPage) return;

  const isAmazonIndia = typeof platform === "string" && platform.trim().toLowerCase() === "amazon"
    && (region === "in" || host === "google.co.in");
  const googleRetailer = isAmazonIndia ? "Amazon India" : indianRetailerName(platform);
  if (googleRetailer) return { platform: googleRetailer, url };
}

export function indianListingKey(offer) {
  const link = parseOfferLink(resolveIndianOffer(offer)?.url);
  const retailer = directRetailer(link);
  if (retailer === "Amazon India") {
    const asin = link.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?:\/|$)/i)?.[1];
    if (asin) return `amazon:${asin.toUpperCase()}`;
  }
  if (retailer === "Flipkart") {
    const item = link.pathname.match(/\/p\/([a-z0-9]+)(?:\/|$)/i)?.[1];
    const pid = link.searchParams.get("pid");
    if (item) return pid ? `flipkart:pid:${pid.toUpperCase()}` : `flipkart:item:${item.toLowerCase()}`;
  }
}

export function googleShoppingListing(offer) {
  const verified = resolveIndianOffer(offer);
  if (!verified || !["Amazon India", "Flipkart"].includes(verified.platform)) return;
  const link = parseOfferLink(verified.url);
  if (directRetailer(link) || link.searchParams.get("ibp") !== "oshop") return;
  const fields = (link.searchParams.get("prds") ?? "").split(",");
  const offerId = fields.find((field) => /^headlineOfferDocid:\d{1,24}$/i.test(field))?.split(":")[1];
  if (!offerId) return;
  const productId = fields.filter((field) =>
    /^(?:catalogid|productid|headlineOfferDocid|gpcid|imageDocid|mid):\d{0,24}$/i.test(field)).join(",");
  return { productId, offerId, platform: verified.platform };
}

export function indianOffers(offers = []) {
  const byRetailer = new Map();
  for (const offer of offers) {
    if (offer.currency !== "INR" || offer.availability === false || !Number.isFinite(offer.price) || offer.price <= 0) continue;
    const verified = resolveIndianOffer(offer);
    if (!verified || offer.price >= (byRetailer.get(verified.platform)?.price ?? Infinity)) continue;
    byRetailer.set(verified.platform, { ...(offer.toObject?.() ?? offer), ...verified });
  }
  return [...byRetailer.values()].sort((a, b) => a.price - b.price);
}

export function withIndianOffers(product, offers = product.sellers) {
  const sellers = indianOffers(offers);
  return { ...product, sellers, bestPrice: sellers[0]?.price ?? null };
}
