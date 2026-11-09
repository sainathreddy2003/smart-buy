import mongoose from "mongoose";

const searchHistorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    query: { type: String, required: true, trim: true, maxlength: 500 },
    structuredRequirements: { type: mongoose.Schema.Types.Mixed },
    recommendation: { type: mongoose.Schema.Types.ObjectId, ref: "Recommendation" },
    resultCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

searchHistorySchema.index({ user: 1, createdAt: -1 });

export const SearchHistory = mongoose.model("SearchHistory", searchHistorySchema);
