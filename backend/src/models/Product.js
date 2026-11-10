import mongoose from "mongoose";
import { withIndianOffers } from "../utils/indianRetailers.js";

export const CATEGORIES = [
  "smartphone",
  "laptop",
  "headphones",
  "smartwatch",
  "tablet",
  "monitor",
];

export const sellerSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    url: { type: String, required: true },
    availability: { type: Boolean, default: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true, index: true },
    category: { type: String, required: true, enum: CATEGORIES, index: true },
    model: { type: String, trim: true },

    // Multi-seller pricing — the source of truth for price comparison.
    // `bestPrice` is denormalized from `sellers` on save, purely so Mongo can
    // filter/sort/index on price without an aggregation on every query.
    sellers: {
      type: [sellerSchema],
      validate: (v) => Array.isArray(v) && v.length > 0,
    },
    bestPrice: { type: Number, index: true },

    rating: { type: Number, min: 0, max: 5, default: 4.3 },
    reviewCount: { type: Number, default: 0 },
    releaseYear: { type: Number },
    tagline: { type: String, trim: true },
    description: { type: String, trim: true },
    images: [{ type: String }],

    // Free-form key/value spec sheet — kept for display, flexible across categories.
    specs: { type: Map, of: String, default: {} },

    // Normalized numeric specs — what the scoring engine actually reads.
    // Populated by utils/normalization.js at ingestion/seed time, never hand-typed
    // in parallel with `specs` (that's exactly the duplication normalization exists
    // to avoid).
    normalizedSpecs: {
      ramGB: { type: Number },
      storageGB: { type: Number },
      cpuTier: { type: Number, min: 0, max: 5 }, // relative performance tier, category-specific
      gpuTier: { type: Number, min: 0, max: 5 }, // 0 = no dedicated GPU
      displayScore: { type: Number, min: 0, max: 5 },
      batteryHours: { type: Number },
      portabilityScore: { type: Number, min: 0, max: 5 }, // higher = lighter/more portable
    },

    features: [{ type: String }],
    useCases: [{ type: String, index: true }], // e.g. gaming, productivity, photography, fitness
    colors: [{ type: String }],
    inStock: { type: Boolean, default: true },

    // Provenance — which provider produced this record. Never fabricated.
    source: { type: String, enum: ["seed", "mock", "rapidapi", "serpapi"], default: "seed" },
    sourceProductId: { type: String },
    shoppingHistoryId: { type: String },
  },
  { timestamps: true, toJSON: { transform: (_doc, product) => withIndianOffers(product) } }
);

productSchema.index({ name: "text", brand: "text", tagline: "text" });

productSchema.pre("save", function computeBestPrice() {
  if (this.sellers?.length) {
    this.bestPrice = Math.min(...this.sellers.map((s) => s.price));
  }
});

export const Product = mongoose.model("Product", productSchema);
