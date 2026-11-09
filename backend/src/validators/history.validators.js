import { z } from "zod";

export const logSearchSchema = z.object({
  body: z.object({
    query: z.string().trim().min(1).max(500),
    structuredRequirements: z.record(z.string(), z.any()).optional(),
  }),
});
