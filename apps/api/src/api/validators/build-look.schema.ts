import { z } from "zod";
import {
  BUILD_LOOK_STYLES,
  BUILD_LOOK_BUDGETS,
  SHOP_AUDIENCES,
} from "@stylaiize/shared";
import { styleProfileSchema } from "./style-profile.schema";

const buildLookItemSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(160),
    subtitle: z.string().trim().max(200).default(""),
    description: z.string().trim().max(500).default(""),
    // `.default(null)` (not `.optional()`) keeps the inferred output type as
    // `string | null` — a required key holding a nullable value. That matches
    // `BuildYourLookItem` exactly, so `currentItems` is assignable without casts.
    brand: z.string().trim().max(120).nullable().default(null),
    material: z.string().trim().max(120).default(""),
    color: z.string().trim().min(1).max(80),
    size: z.string().trim().max(40).default(""),
    price: z.number().int().min(0).max(1_000_000),
    originalPrice: z.number().int().min(0).max(1_000_000),
    rating: z.number().min(0).max(5).default(0),
    store: z.string().trim().max(120).default(""),
    category: z.string().trim().min(1).max(60),
    imageUrl: z.string().url().max(2000).nullable().default(null),
  })
  .strict();

const weatherSchema = z
  .object({
    condition: z.string().trim().min(1).max(80),
    temperatureC: z.number().finite().min(-50).max(60),
    isRainy: z.boolean(),
  })
  .strict();

/**
 * Shared prompt context. Every build-look operation (generate, replace-item,
 * add-item) needs the full styling brief so the AI keeps the look coherent.
 */
const buildLookPromptSchema = z
  .object({
    eventName: z.string().trim().min(2).max(120),
    audience: z.enum(SHOP_AUDIENCES, {
      required_error: "Select who this look is for.",
      invalid_type_error: "Select who this look is for.",
    }),
    occasion: z.string().trim().max(120).optional(),
    dressCode: z.string().trim().max(120).optional(),
    style: z.enum(BUILD_LOOK_STYLES),
    budget: z.enum(BUILD_LOOK_BUDGETS),
    colors: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
    fit: z.string().trim().max(60).optional(),
    brand: z.string().trim().max(60).optional(),
    season: z.string().trim().max(60).optional(),
    weather: weatherSchema.nullable().optional(),
  })
  .strict();

export const generateBuildLookSchema = buildLookPromptSchema.extend({
  includeGrooming: z.boolean().default(true),
  styleProfile: styleProfileSchema.optional(),
});

const currentItemsSchema = buildLookPromptSchema.extend({
  currentItems: z.array(buildLookItemSchema).min(1).max(20),
});

export const replaceBuildLookItemSchema = currentItemsSchema.extend({
  itemId: z.string().trim().min(1).max(120),
  reason: z.string().trim().max(300).optional(),
});

export const addBuildLookItemSchema = currentItemsSchema.extend({
  category: z.string().trim().min(1).max(60).optional(),
  reason: z.string().trim().max(300).optional(),
});

export const shopBuildLookSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            itemId: z.string().trim().min(1).max(120),
            name: z.string().trim().min(1).max(160),
            category: z.string().trim().min(1).max(60),
            color: z.string().trim().max(80).nullable().optional(),
            brand: z.string().trim().max(120).nullable().optional(),
            size: z.string().trim().max(40).nullable().optional(),
            gender: z.string().trim().max(40).nullable().optional(),
            audience: z.enum(SHOP_AUDIENCES).optional(),
            style: z.enum(BUILD_LOOK_STYLES).optional(),
            query: z.string().trim().max(200).nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    audience: z.enum(SHOP_AUDIENCES, {
      required_error: "Select who this look is for.",
      invalid_type_error: "Select who this look is for.",
    }),
    occasion: z.string().trim().max(120).optional(),
    style: z.string().trim().max(80).optional(),
    budget: z.enum(BUILD_LOOK_BUDGETS).optional(),
    pinCode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter a valid 6-digit PIN code.")
      .nullable()
      .optional(),
  })
  .strict();

const completeOutfitImageItemSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(60),
    color: z.string().trim().min(1).max(80),
    material: z.string().trim().max(120).optional(),
    size: z.string().trim().max(40).optional(),
    description: z.string().trim().max(500).optional(),
    productId: z.string().trim().min(1).max(120).optional(),
    imageUrl: z
      .string()
      .trim()
      .url()
      .refine((value) => /^https:\/\//i.test(value), "must be an https URL")
      .nullable()
      .optional(),
    brand: z.string().trim().max(120).nullable().optional(),
    price: z.number().finite().nonnegative().optional(),
    currency: z.string().trim().length(3).optional(),
    colors: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    sizes: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
    source: z.string().trim().max(120).optional(),
  })
  .strict();

export const completeOutfitImageSchema = z
  .object({
    eventName: z.string().trim().min(1).max(160),
    audience: z.enum(SHOP_AUDIENCES, {
      required_error: "Select who this look is for.",
      invalid_type_error: "Select who this look is for.",
    }),
    occasion: z.string().trim().max(120).optional(),
    dressCode: z.string().trim().max(120).optional(),
    dressCodeReason: z.string().trim().max(500).optional(),
    style: z.string().trim().min(1).max(80),
    budget: z.string().trim().max(40).optional(),
    season: z.string().trim().max(400).optional(),
    colors: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    fit: z.string().trim().max(200).optional(),
    fitGuidance: z.string().trim().max(400).optional(),
    colorCombination: z.string().trim().max(300).optional(),
    footwear: z.string().trim().max(300).optional(),
    accessories: z.array(z.string().trim().min(1).max(160)).max(10).optional(),
    occasionSuitability: z.string().trim().max(400).optional(),
    seasonSuitability: z.string().trim().max(400).optional(),
    explanation: z.string().trim().max(1200).optional(),
    items: z.array(completeOutfitImageItemSchema).min(1).max(20),
  })
  .strict();

export type GenerateBuildLookInput = z.infer<typeof generateBuildLookSchema>;
export type ReplaceBuildLookItemInput = z.infer<typeof replaceBuildLookItemSchema>;
export type AddBuildLookItemInput = z.infer<typeof addBuildLookItemSchema>;
export type ShopBuildLookInput = z.infer<typeof shopBuildLookSchema>;
export type CompleteOutfitImageInput = z.infer<typeof completeOutfitImageSchema>;
