import { z } from "zod";

export const compareProductsSchema = z.object({
  body: z.object({
    productIds: z.array(z.string().min(1)).min(2).max(4),
  }),
});
