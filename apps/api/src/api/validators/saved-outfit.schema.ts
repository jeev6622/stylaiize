import { z } from "zod";
import {
  OUTFIT_CATEGORIES,
  OUTFIT_ITEM_TYPES,
  SAVED_OUTFIT_SOURCES,
  SHOP_AUDIENCES,
  type OutfitItem,
  type OutfitScores,
} from "@stylaiize/shared";
import { groomingPlanSchema } from "./grooming.schema";

const OutfitItemSchema = z.object({
  type: z.enum(OUTFIT_ITEM_TYPES),
  name: z.string().min(1).max(160),
  brand: z.string().nullable().optional(),
  color: z.string().min(1).max(60),
  price: z.number().nullable().optional(),
  currency: z.string().min(1).max(12),
  buyUrl: z.string().url().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  reason: z.string().default(""),
}) satisfies z.ZodType<OutfitItem>;

const OutfitScoresSchema = z.object({
  fashion: z.number().min(0).max(100),
  eventMatch: z.number().min(0).max(100),
  comfort: z.number().min(0).max(100),
  budget: z.number().min(0).max(100),
}) satisfies z.ZodType<OutfitScores>;

export const createSavedOutfitSchema = z.object({
  name: z.string().trim().min(1, "Outfit name is required.").max(160),
  category: z.enum(OUTFIT_CATEGORIES).default("casual"),
  audience: z.enum(SHOP_AUDIENCES).default("all"),
  occasion: z.string().trim().max(120).nullable().optional(),
  style: z.string().trim().max(120).nullable().optional(),
  colors: z.array(z.string().trim().max(60)).max(20).optional(),
  budget: z.number().min(0).nullable().optional(),
  items: z.array(OutfitItemSchema).min(1, "At least one item is required."),
  scores: OutfitScoresSchema.nullable().optional(),
  totalCost: z.number().min(0).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  explanation: z.string().max(1000).nullable().optional(),
  grooming: groomingPlanSchema.nullable().optional(),
  source: z.enum(SAVED_OUTFIT_SOURCES).optional(),
});

export const updateSavedOutfitSchema = createSavedOutfitSchema.partial();

export type CreateSavedOutfitInput = z.infer<typeof createSavedOutfitSchema>;
export type UpdateSavedOutfitInput = z.infer<typeof updateSavedOutfitSchema>;
