import mongoose from "mongoose";
import { sellerSchema } from "./Product.js";
import { withIndianOffers } from "../utils/indianRetailers.js";
import { isWholeProductListing } from "../utils/productListing.js";

const pickSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    offers: { type: [sellerSchema], default: undefined },
    rank: { type: Number, required: true },
    matchScore: { type: Number, min: 0, max: 100 },
    rankingSource: { type: String, enum: ["groq"] },
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
    shortlistedModels: [{ name: { type: String, required: true }, brand: { type: String, required: true }, _id: false }],
    picks: [pickSchema],
    summary: { type: String },
  },
  { timestamps: true }
);

export const Recommendation = mongoose.model("Recommendation", recommendationSchema);

// Rebrand older saved recommendations at the response boundary as well.
function wiseBuyCopy(text) {
  return text?.replace(/\bGroq shortlisted\b/gi, "WiseBuy suggested")
    .replace(/\bShortlisted by Groq\b/gi, "Suggested by WiseBuy")
    .replace(/\bSmartBuy(?: AI)?\b/gi, "WiseBuy");
}

export function serializeRecommendation(recommendation) {
  const response = recommendation.toObject();
  response.summary = wiseBuyCopy(response.summary);
  const hadPicks = response.picks.length > 0;
  const { min, max } = response.preferences?.budget ?? {};
  response.picks = response.picks.flatMap(({ product, offers, ...pick }) => {
    if (!product?.name) return [];
    if (!isWholeProductListing(product.listingTitle || product.name, product.category || response.preferences?.category)) return [];
    const eligible = (offers ?? product.sellers ?? []).filter(({ price }) => price >= (min ?? 0) && price <= (max ?? Infinity));
    const filteredProduct = withIndianOffers(product, eligible);
    return filteredProduct.sellers.length ? [{ ...pick, reasoning: wiseBuyCopy(pick.reasoning), product: filteredProduct }] : [];
  });
  if (hadPicks && !response.picks.length) {
    response.summary = "This saved search has no eligible offers from Amazon India, Flipkart, or Croma. Start a new search for current offers.";
  }
  return response;
}
