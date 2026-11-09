import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { searchReviews } from "../services/youtube.service.js";

export const searchYoutubeReviews = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || String(q).trim().length < 2) {
    throw ApiError.badRequest("Query parameter 'q' is required");
  }
  const result = await searchReviews(String(q));
  res.json({ success: true, ...result });
});
