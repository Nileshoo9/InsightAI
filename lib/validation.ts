import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8).max(72)
});

export const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1)
});

export const analyzeSchema = z.object({
  fileId: z.string().min(1).optional(),
  prompt: z.string().trim().optional(),
  data: z
    .array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])))
    .optional()
});
