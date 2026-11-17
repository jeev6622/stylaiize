import { z } from "zod";
import { EVENT_CATEGORIES } from "@stylaiize/shared";

export const createCalendarEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  location: z.string().trim().max(200).nullable().optional(),
  eventCategory: z.enum(EVENT_CATEGORIES).nullable().optional(),
  dressCode: z.string().trim().max(100).nullable().optional(),
  reminderDays: z.array(z.number().int().min(0).max(30)).max(5).optional(),
});

export const updateCalendarEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  eventCategory: z.enum(EVENT_CATEGORIES).nullable().optional(),
  dressCode: z.string().trim().max(100).nullable().optional(),
  isOutfitPlanned: z.boolean().optional(),
  reminderDays: z.array(z.number().int().min(0).max(30)).max(5).optional(),
});

export type CreateCalendarEventSchemaInput = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventSchemaInput = z.infer<typeof updateCalendarEventSchema>;
