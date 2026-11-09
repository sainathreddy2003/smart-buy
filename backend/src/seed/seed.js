import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Product } from "../models/Product.js";
import { PriceHistory } from "../models/PriceHistory.js";
import { productsData } from "./products.data.js";
import {
  parseRAM,
  parseStorage,
  parseBatteryHours,
  tierFromCPU,
  tierFromGPU,
  scoreFromDisplay,
  scoreFromWeight,
} from "../utils/normalization.js";

/**
 * Runs each product's loosely-formatted rawSpecs through the normalization
 * utilities to produce the numeric fields the recommendation engine scores
 * against. This is the normalization pipeline actually being exercised, not
 * numbers hand-typed twice.
 */
function normalizeProductSpecs(rawSpecs, category) {
  const cpuSource = rawSpecs.Processor || rawSpecs.Chip || "";
  const gpuSource = rawSpecs.GPU || rawSpecs.Graphics || "";
  return {
    ramGB: parseRAM(rawSpecs.RAM),
    storageGB: parseStorage(rawSpecs.Storage),
    cpuTier: tierFromCPU(cpuSource),
    gpuTier: tierFromGPU(gpuSource),
    displayScore: scoreFromDisplay({ refreshRate: rawSpecs.RefreshRate, panel: rawSpecs.Panel || rawSpecs.Display }),
    batteryHours: parseBatteryHours(rawSpecs.Battery, category, cpuSource),
    portabilityScore: scoreFromWeight(rawSpecs.Weight, category),
  };
}

function buildProductDoc(raw) {
  const { rawSpecs, sellers, ...rest } = raw;
  return {
    ...rest,
    sellers,
    bestPrice: Math.min(...sellers.map((s) => s.price)),
    specs: rawSpecs,
    normalizedSpecs: normalizeProductSpecs(rawSpecs, raw.category),
    source: "seed",
  };
}

/**
 * Backfills a plausible 30-day price series ending at the product's current
 * best price — clearly marked source:"seed" so the API/UI can be honest that
 * this is demo history, never presented as an observed live trend.
 */
function buildPriceHistory(product) {
  const entries = [];
  const endPrice = product.bestPrice;
  const platform = product.sellers.reduce((best, s) => (s.price < best.price ? s : best)).platform;

  // Deterministic-ish "randomness" seeded from the product name so re-seeding
  // produces a stable, reproducible demo dataset rather than a different
  // chart every run.
  let seed = [...product.name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  let price = Math.round(endPrice * (1 + (rand() - 0.3) * 0.12));
  const now = Date.now();
  for (let daysAgo = 30; daysAgo >= 0; daysAgo -= 1) {
    const drift = (rand() - 0.5) * 0.03;
    price = Math.round(price * (1 + drift));
    if (daysAgo === 0) price = endPrice;
    entries.push({
      product: product._id,
      platform,
      price,
      source: "seed",
      timestamp: new Date(now - daysAgo * 24 * 60 * 60 * 1000),
    });
  }
  return entries;
}

async function run() {
  await connectDB();

  console.log("[seed] clearing existing products and price history...");
  await Product.deleteMany({});
  await PriceHistory.deleteMany({});

  console.log(`[seed] inserting ${productsData.length} products...`);
  const docs = productsData.map(buildProductDoc);
  const inserted = await Product.insertMany(docs);

  console.log("[seed] backfilling demo price history...");
  const historyEntries = inserted.flatMap(buildPriceHistory);
  await PriceHistory.insertMany(historyEntries);

  console.log(`[seed] done — ${inserted.length} products, ${historyEntries.length} price history entries.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
