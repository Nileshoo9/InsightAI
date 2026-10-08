import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8).max(72)
});

export const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1)
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72)
});

export const analyzeSchema = z.object({
  fileId: z.string().min(1),
  prompt: z.string().trim().max(1000).optional()
}).strict();
