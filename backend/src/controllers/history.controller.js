import { asyncHandler } from "../utils/asyncHandler.js";
import { SearchHistory } from "../models/SearchHistory.js";

export const getMySearchHistory = asyncHandler(async (req, res) => {
  const history = await SearchHistory.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate("recommendation", "_id createdAt");
  res.json({ success: true, history });
});

// A manual log entry — the primary write path is automatic (recommendation
// controller logs on every successful search), this exists for API-literal
// completeness and for clients that want to record a search without
// generating a full recommendation.
export const logSearch = asyncHandler(async (req, res) => {
  const { query, structuredRequirements } = req.body;
  const entry = await SearchHistory.create({
    user: req.user._id,
    query,
    structuredRequirements,
  });
  res.status(201).json({ success: true, entry });
});
