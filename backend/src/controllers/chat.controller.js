import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Recommendation, serializeRecommendation } from "../models/Recommendation.js";
import { completeChat } from "../services/ai.service.js";

function buildSystemPrompt(recommendation) {
  const picksSummary = recommendation.picks
    .map(
      (pick, i) =>
        `${i + 1}. ${pick.product.name} (₹${pick.product.bestPrice}) — ${pick.reasoning}`
    )
    .join("\n");

  return `You are SmartBuy AI, a friendly and knowledgeable gadget-buying assistant.
The shopper already received these recommendations:
${picksSummary}

Shopper's original preferences: ${JSON.stringify(recommendation.preferences)}

Answer their follow-up questions about these specific products, help them compare picks, and give a clear, honest opinion when asked "which one should I buy?". Keep answers concise (3-5 sentences) and conversational. Never invent specs you weren't given.`;
}

export const chatWithAssistant = asyncHandler(async (req, res) => {
  const { recommendationId, message, history = [] } = req.body;

  const recommendation = await Recommendation.findById(recommendationId).populate(
    "picks.product"
  );
  if (!recommendation) throw ApiError.notFound("Recommendation not found");

  try {
    const reply = await completeChat({
      system: buildSystemPrompt(serializeRecommendation(recommendation)),
      history: [...history.slice(-8), { role: "user", content: message }],
    });
    res.json({ success: true, reply });
  } catch {
    throw ApiError.badRequest(
      "Follow-up chat needs an AI provider configured (GROQ_API_KEY) — this deployment is running without one."
    );
  }
});
