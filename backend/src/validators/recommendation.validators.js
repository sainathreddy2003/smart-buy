import { z } from "zod";
import { CATEGORIES } from "../models/Product.js";

// Accepts either the legacy guided-wizard body or the richer AI/deterministic
// structured-requirement body — recommendation.service.js normalizes whichever
// shows up into one canonical shape. `category` is always required: by the
// time this endpoint is called, any clarification step must already be done.
export const createRecommendationSchema = z.object({
  body: z
    .object({
      category: z.enum(CATEGORIES),
      // The original free-text query, if this came from the natural-language
      // search box — used only for search-history logging.
      query: z.string().trim().max(500).optional(),

      // Legacy guided-wizard fields.
      budgetMin: z.number().min(0).optional(),
      budgetMax: z.number().min(0).optional(),
      useCase: z.string().trim().max(60).optional(),
      mustHaveFeatures: z.array(z.string().trim().max(60)).max(10).optional(),
      notes: z.string().trim().max(500).optional(),

      // Structured-requirement fields (from /api/ai/analyze-requirement).
      budget: z
        .object({ min: z.number().min(0).nullable(), max: z.number().min(0).nullable(), currency: z.literal("INR") })
        .optional(),
      useCases: z.array(z.string()).max(6).optional(),
      requirements: z.record(z.string(), z.any()).optional(),
      priorities: z.record(z.string(), z.number()).optional(),
      keywords: z.array(z.string()).max(10).optional(),
    })
    .passthrough(),
});

export const chatMessageSchema = z.object({
  body: z.object({
    recommendationId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid recommendation ID").optional(),
    productId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid product ID").optional(),
    message: z.string().trim().min(1).max(1000),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().max(2000),
        })
      )
      .max(20)
      .optional(),
  }).refine((body) => Boolean(body.recommendationId) !== Boolean(body.productId), {
    message: "Provide either a recommendation ID or a product ID",
  }),
});
