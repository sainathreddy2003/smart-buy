import mongoose from "mongoose";

const priceHistorySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    platform: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    // "seed" = backfilled demo history at seed time, clearly not a live observation.
    // "live" = actually observed via a provider refresh.
    source: { type: String, enum: ["seed", "live"], default: "seed" },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: false }
);

priceHistorySchema.index({ product: 1, timestamp: -1 });

export const PriceHistory = mongoose.model("PriceHistory", priceHistorySchema);
