import { PriceHistory } from "../models/PriceHistory.js";
import { indianOffers, indianRetailerName } from "../utils/indianRetailers.js";

const HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Sellers sorted cheapest-first, with the best one flagged. */
export function comparePrices(product) {
  return indianOffers(product.sellers).map((seller, index) => ({ ...seller, isBest: index === 0 }));
}

/**
 * 30-day low/high + % change vs the immediately preceding recorded price.
 * A single recorded price has no previous observation to compare against.
 */
export async function getPriceHistory(productId) {
  const now = Date.now();
  const recorded = await PriceHistory.find({
    product: productId,
    timestamp: { $gte: new Date(now - HISTORY_WINDOW_MS), $lte: new Date(now) },
  }).sort({ timestamp: 1, _id: 1 }).lean();
  const entries = recorded.flatMap(({ platform, price, timestamp, source = "seed" }) => {
    const retailer = indianRetailerName(platform === "Amazon" && source === "seed" ? "Amazon India" : platform);
    return retailer ? [{ platform: retailer, price, timestamp, source }] : [];
  });

  if (entries.length === 0) {
    return { entries: [], limited: true, low: null, high: null, current: null, changePercent: null };
  }

  let low = entries[0].price;
  let high = low;
  for (const { price } of entries) {
    low = Math.min(low, price);
    high = Math.max(high, price);
  }
  const current = entries.at(-1).price;
  const previous = entries.at(-2)?.price;
  const changePercent = previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null;

  return {
    entries,
    limited: entries.length < 2,
    low,
    high,
    current,
    changePercent,
  };
}
