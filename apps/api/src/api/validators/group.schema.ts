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

export const groupStyleSchema = z.object({
  members: z.array(memberSchema).min(2, "Add at least two members.").max(10),
  event: eventContextSchema,
  budget: z.string().trim().max(60).optional(),
});

export type GroupStyleInput = z.infer<typeof groupStyleSchema>;