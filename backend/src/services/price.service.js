import { PriceHistory } from "../models/PriceHistory.js";
import { indianOffers, indianRetailerName } from "../utils/indianRetailers.js";
import { getRapidApiPriceHistory } from "./providers/RapidApiPriceHistoryProvider.js";

const HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const INDIA_DAY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

/** Sellers sorted cheapest-first, with the best one flagged. */
export function comparePrices(product) {
  return indianOffers(product.sellers).map((seller, index) => ({ ...seller, isBest: index === 0 }));
}

/**
 * 30-day low/high + % change vs the immediately preceding recorded price.
 * A single recorded price has no previous observation to compare against.
 */
export async function getPriceHistory(product) {
  const now = Date.now();
  const from = now - HISTORY_WINDOW_MS;
  const recorded = await PriceHistory.find({
    product: product._id,
    timestamp: { $gte: new Date(from), $lte: new Date(now) },
  }).sort({ timestamp: 1, _id: 1 }).lean();
  const entries = recorded.flatMap(({ platform, price, timestamp, source = "seed" }) => {
    const retailer = indianRetailerName(platform === "Amazon" && source === "seed" ? "Amazon India" : platform);
    return retailer ? [{ platform: retailer, price, timestamp, source }] : [];
  });

  const recordedDays = new Set(entries.map(({ timestamp }) => INDIA_DAY_FORMAT.format(new Date(timestamp))));
  try {
    const historical = await getRapidApiPriceHistory(product);
    for (const entry of historical) {
      const timestamp = Date.parse(`${entry.timestamp}T00:00:00+05:30`);
      if (timestamp >= from && timestamp <= now && !recordedDays.has(entry.timestamp)) entries.push(entry);
    }
    entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  } catch (err) {
    console.warn(`[PRICE HISTORY] ${err.message}`);
  }

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
