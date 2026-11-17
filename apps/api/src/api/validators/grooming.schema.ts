import { z } from "zod";
import { GROOMING_CATEGORIES } from "@stylaiize/shared";

export const groomingItemSchema = z.object({
  category: z.enum(GROOMING_CATEGORIES),
  title: z.string().trim().min(1).max(160),
  why: z.string().trim().max(500).default(""),
  tip: z.string().trim().max(500).default(""),
  estimatedPriceInr: z.number().min(0).max(1_000_000).optional(),
});

export const groomingPlanSchema = z.object({
  items: z.array(groomingItemSchema).min(4).max(6),
  summary: z.string().trim().max(600).default(""),
});
