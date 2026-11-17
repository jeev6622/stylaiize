import { z } from "zod";
import { BUILD_LOOK_STYLES, BUILD_LOOK_BUDGETS } from "@stylaiize/shared";
import { styleProfileSchema } from "./style-profile.schema";

const buildLookItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subtitle: z.string().default(""),
  description: z.string().default(""),
  // `.default(null)` (not `.optional()`) keeps the inferred output type as
  // `string | null` — a required key holding a nullable value. That matches
  // `BuildYourLookItem` exactly, so `currentItems` is assignable without casts.
  brand: z.string().nullable().default(null),
  material: z.string().default(""),
  color: z.string().min(1),
  size: z.string().default(""),
  price: z.number().int().nonnegative(),
  originalPrice: z.number().int().nonnegative(),
  rating: z.number().min(0).max(5).default(4),
  store: z.string().default(""),
  category: z.string().min(1),
  imageUrl: z.string().nullable().default(null),
});

/**
 * Shared prompt context. Every build-look operation (generate, replace-item,
 * add-item) needs the full styling brief so the AI keeps the look coherent.
 */
const buildLookPromptSchema = z.object({
  eventName: z.string().trim().min(2).max(120),
  occasion: z.string().trim().max(120).optional(),
  dressCode: z.string().trim().max(120).optional(),
  style: z.enum(BUILD_LOOK_STYLES),
  budget: z.enum(BUILD_LOOK_BUDGETS),
  colors: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
  fit: z.string().trim().max(60).optional(),
  brand: z.string().trim().max(60).optional(),
  season: z.string().trim().max(60).optional(),
});

export const generateBuildLookSchema = buildLookPromptSchema.extend({
  includeGrooming: z.boolean().default(true),
  styleProfile: styleProfileSchema.optional(),
});

const currentItemsSchema = buildLookPromptSchema.extend({
  currentItems: z.array(buildLookItemSchema).min(1).max(20),
});

export const replaceBuildLookItemSchema = currentItemsSchema.extend({
  itemId: z.string().min(1),
  reason: z.string().trim().max(300).optional(),
});

export const addBuildLookItemSchema = currentItemsSchema.extend({
  category: z.string().trim().min(1).max(60).optional(),
  reason: z.string().trim().max(300).optional(),
});

export type GenerateBuildLookInput = z.infer<typeof generateBuildLookSchema>;
export type ReplaceBuildLookItemInput = z.infer<typeof replaceBuildLookItemSchema>;
export type AddBuildLookItemInput = z.infer<typeof addBuildLookItemSchema>;