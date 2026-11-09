import { asyncHandler } from "../utils/asyncHandler.js";
import { analyzeRequirement } from "../services/ai.service.js";

export const analyzeRequirementHandler = asyncHandler(async (req, res) => {
  const { query } = req.body;
  const structured = await analyzeRequirement(query);
  console.log(`[AI] Requirement analyzed (source=${structured.source}, category=${structured.category})`);
  res.json({ success: true, query, requirement: structured });
});
