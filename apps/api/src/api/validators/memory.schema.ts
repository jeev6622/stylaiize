import { z } from "zod";
import { styleProfileSchema } from "./style-profile.schema";

export const updateMemorySchema = z.object({
  previousOutfits: z
    .array(z.object({ outfitId: z.string(), eventId: z.string(), wornAt: z.string() }))
    .optional(),
  attendedEvents: z.array(z.string().trim().max(200)).max(500).optional(),
  favoriteBrands: z.array(z.string().trim().max(100)).max(500).optional(),
  favoriteColors: z.array(z.string().trim().max(60)).max(200).optional(),
  budget: z.object({ min: z.number().min(0), max: z.number().min(0) }).nullable().optional(),
  sizes: z.record(z.string(), z.string()).optional(),
  shoppingHistory: z
    .array(z.object({ productId: z.string(), purchasedAt: z.string(), price: z.number().min(0) }))
    .optional(),
  wardrobeOwned: z.array(z.string()).optional(),
});

/**
 * Separate opt-in schema for saving the reviewed style profile. This is not
 * accepted by the general PATCH /memory endpoint, so an analysed photo result
 * can never be persisted without an explicit save action.
 */
export const saveStyleProfileSchema = z.object({
  styleProfile: styleProfileSchema.extend({
    userEdited: z.literal(true, {
      message: "Review the style profile before saving it (userEdited must be true).",
    }),
  }),
});

export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
export type SaveStyleProfileInput = z.infer<typeof saveStyleProfileSchema>;