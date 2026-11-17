import { z } from "zod";
import { EVENT_CATEGORIES } from "@stylaiize/shared";

const eventDetailsSchema = z.object({
  name: z.string().trim().min(1).max(200),
  date: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  dressCode: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
  indoorOutdoor: z.enum(["indoor", "outdoor", "unknown"]).optional().default("unknown"),
  category: z.enum(EVENT_CATEGORIES).optional().default("other"),
  notes: z.string().max(500).nullable().optional(),
});

export const recommendSchema = z.object({
  event: eventDetailsSchema,
  photo: z.string().nullable().optional(),
});

export type RecommendInput = z.infer<typeof recommendSchema>;
