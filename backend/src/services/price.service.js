import { PriceHistory } from "../models/PriceHistory.js";

/** Sellers sorted cheapest-first, with the best one flagged. */
export function comparePrices(product) {
  const sellers = [...product.sellers].sort((a, b) => a.price - b.price);
  return sellers.map((s, i) => ({ ...s.toObject?.() ?? s, isBest: i === 0 }));
}

/**
 * 30-day low/high + % change vs the immediately preceding recorded price.
 * Returns `limited: true` when there isn't enough history to say anything
 * meaningful yet — the UI must show that plainly rather than pretending.
 */
export async function getPriceHistory(productId) {
  const entries = await PriceHistory.find({ product: productId }).sort({ timestamp: 1 });

  if (entries.length === 0) {
    return { entries: [], limited: true, low: null, high: null, current: null, changePercent: null };
  }

  const prices = entries.map((e) => e.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const current = prices[prices.length - 1];
  const previous = prices.length > 1 ? prices[prices.length - 2] : null;
  const changePercent = previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null;

  return {
    entries: entries.map((e) => ({ platform: e.platform, price: e.price, timestamp: e.timestamp, source: e.source })),
    limited: entries.length < 5,
    low,
    high,
    current,
    changePercent,
  };
}
