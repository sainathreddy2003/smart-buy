import { asyncHandler } from "../utils/asyncHandler.js";
import { generateRecommendation } from "../services/recommendation.service.js";
import { Recommendation, serializeRecommendation } from "../models/Recommendation.js";
import { SearchHistory } from "../models/SearchHistory.js";
import { ApiError } from "../utils/ApiError.js";

export const createRecommendation = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { query, ...body } = req.body;
  const recommendation = await generateRecommendation(body, userId, query);

  if (userId) {
    await SearchHistory.create({
      user: userId,
      query: query || `${body.category} — ${body.useCase || (body.useCases || []).join(", ") || "general search"}`,
      structuredRequirements: recommendation.preferences,
      recommendation: recommendation._id,
      resultCount: recommendation.picks.length,
    });
  }

  res.status(201).json({ success: true, recommendation });
});

export const getRecommendation = asyncHandler(async (req, res) => {
  const recommendation = await Recommendation.findById(req.params.id).populate("picks.product");
  if (!recommendation) throw ApiError.notFound("Recommendation not found");
  res.json({ success: true, recommendation: serializeRecommendation(recommendation) });
});

export const getMyRecommendationHistory = asyncHandler(async (req, res) => {
  const recommendations = await Recommendation.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("picks.product");
  res.json({ success: true, recommendations: recommendations.map(serializeRecommendation) });
});
