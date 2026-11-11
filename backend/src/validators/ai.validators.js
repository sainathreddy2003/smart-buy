import { z } from "zod";
import { CATEGORIES } from "../models/Product.js";

export const analyzeRequirementSchema = z.object({
  body: z.object({
    query: z.string().trim().min(3).max(500),
  }),
});

const priorityWeights = z.object({
  cpu: z.number().min(0).max(1),
  gpu: z.number().min(0).max(1),
  ram: z.number().min(0).max(1),
  storage: z.number().min(0).max(1),
  display: z.number().min(0).max(1),
  battery: z.number().min(0).max(1),
  portability: z.number().min(0).max(1),
});

/**
 * The canonical structured-requirement shape produced by either the AI path
 * or the deterministic fallback (utils/deterministicParser.js). Validating
 * the AI's JSON against this schema is what lets us safely retry-then-fall-
 * back instead of trusting the model blindly (spec §42).
 */
export const structuredRequirementSchema = z.object({
  category: z.enum(CATEGORIES).nullable(),
  budget: z.object({
    min: z.number().min(0).nullable(),
    max: z.number().min(0).nullable(),
    currency: z.literal("INR"),
  }),
  useCases: z.array(z.string()).max(6),
  requirements: z.object({
    ram: z.object({ minimum: z.number().nullable() }),
    storage: z.object({ minimum: z.number().nullable() }),
    gpu: z.object({ required: z.boolean() }),
    battery: z.object({ minimum: z.number().nullable() }),
    anc: z.object({ required: z.boolean() }),
    portability: z.object({ important: z.boolean() }),
  }),
  priorities: priorityWeights,
  keywords: z.array(z.string()).max(10),
  clarificationNeeded: z.boolean(),
  clarifyingQuestion: z.string().nullable(),
});

/**
 * The AI's job here is narrower than requirement analysis: name WHICH real
 * products are worth looking up, not state their price/specs (those always
 * come from a live search afterward — see suggestProductNames in
 * ai.service.js). A hallucinated name just fails to match anything in the
 * live search and gets dropped. Validation keeps malformed or generic search
 * terms out; live model matching still has to verify that a model exists.
 */
export const productSuggestionSchema = z.object({
  products: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120)
          .refine((name) => !/https?:\/\/|\b(?:under|budget|cheap(?:est)?|best|suggest|recommend)\b|₹/i.test(name), "Use a product model, not a search query")
          .refine((name) => !/^(?:(?:camera|gaming|student|general|everyday|wireless)\s+)*(?:phone|smartphone|laptop|headphones?|smartwatch|tablet|monitor)s?$/i.test(name), "A specific product model is required"),
        brand: z.string().trim().min(1).max(40),
        cameraFit: z.enum(["strong", "value", "uncertain"]).optional(),
      }).refine(({ name, brand }) => {
        const normalizeName = (value) => value.toLocaleLowerCase("en-IN")
          .replace(/\+/g, " plus ").replace(/(\d)plus\b/g, "$1 plus")
          .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
        return normalizeName(name) !== normalizeName(brand);
      }, "A brand name alone does not identify a product model")
    )
    .max(8),
});
