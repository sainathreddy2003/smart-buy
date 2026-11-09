import mongoose from "mongoose";
import { sellerSchema } from "./Product.js";

const pickSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    offers: { type: [sellerSchema], default: undefined },
    rank: { type: Number, required: true },
    matchScore: { type: Number, min: 0, max: 100 },
    reasoning: { type: String, required: true },
    tradeoffs: { type: String },
  },
  { _id: false }
);

const recommendationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, // null for guest sessions
    // The canonical structured requirement the engine scored against
    // (category, budget, useCases, requirements, priorities, keywords) —
    // stored as-is (Mixed) since its shape is validated upstream by Zod, not
    // re-declared here.
    preferences: { type: mongoose.Schema.Types.Mixed, required: true },
    // The shopper's original free-text search, when this came from the
    // natural-language search box — shown back to them on the results page.
    originalQuery: { type: String, trim: true },
    picks: [pickSchema],
    summary: { type: String },
  },
  { timestamps: true }
);

export const Recommendation = mongoose.model("Recommendation", recommendationSchema);

// Old recommendations have no offer snapshot and retain their original shape.
export function serializeRecommendation(recommendation) {
  const response = recommendation.toObject();
  for (const pick of response.picks) {
    if (pick.product && pick.offers?.length) {
      pick.product.sellers = pick.offers;
      pick.product.bestPrice = Math.min(...pick.offers.map((offer) => offer.price));
    }
    delete pick.offers;
  }
  return response;
}
