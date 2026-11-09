import { z } from "zod";

export const signupSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    email: z.string().trim().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  }),
});
