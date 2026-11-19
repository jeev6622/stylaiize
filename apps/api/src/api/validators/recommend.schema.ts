import { z } from "zod";
import { EVENT_CATEGORIES } from "@stylaiize/shared";

const weatherSchema = z
  .object({
    condition: z.string().trim().min(1).max(80),
    temperatureC: z.number().finite().min(-50).max(60),
    feelsLikeC: z.number().finite().min(-60).max(70).optional(),
    humidity: z.number().finite().min(0).max(100).optional(),
    windSpeedKph: z.number().finite().min(0).max(400).optional(),
    chanceOfRain: z.number().finite().min(0).max(100).optional(),
    isRainy: z.boolean(),
    isHot: z.boolean().optional(),
    isCold: z.boolean().optional(),
    season: z.enum(["spring", "summer", "autumn", "winter"]).optional(),
  })
  .strict();

const eventDetailsSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    date: z.string().nullable().optional(),
    time: z.string().nullable().optional(),
    venue: z.string().nullable().optional(),
    dressCode: z.string().nullable().optional(),
    theme: z.string().nullable().optional(),
    weather: weatherSchema.nullable().optional(),
    indoorOutdoor: z.enum(["indoor", "outdoor", "unknown"]).optional().default("unknown"),
    category: z.enum(EVENT_CATEGORIES).optional().default("other"),
    notes: z.string().max(500).nullable().optional(),
  })
  .strict();

export const recommendSchema = z
  .object({
    event: eventDetailsSchema,
    photo: z.string().nullable().optional(),
  })
  .strict();

export type RecommendInput = z.infer<typeof recommendSchema>;
