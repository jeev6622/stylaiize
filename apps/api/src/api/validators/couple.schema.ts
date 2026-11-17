import { z } from "zod";
import { EVENT_CATEGORIES } from "@stylaiize/shared";

const eventContextSchema = z.object({
  name: z.string().trim().min(1, "Event name is required.").max(200),
  category: z.enum(EVENT_CATEGORIES).optional(),
  dressCode: z.string().trim().max(120).nullable().optional(),
  venue: z.string().trim().max(200).nullable().optional(),
});

const memberSchema = z.object({
  name: z.string().trim().min(1, "Member name is required.").max(100),
  preferredColors: z.array(z.string().trim().max(60)).max(20).optional(),
});

export const coupleStyleSchema = z.object({
  memberA: memberSchema,
  memberB: memberSchema,
  event: eventContextSchema,
  budget: z.string().trim().max(60).optional(),
});

export type CoupleStyleInput = z.infer<typeof coupleStyleSchema>;