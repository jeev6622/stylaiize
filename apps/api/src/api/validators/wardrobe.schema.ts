import { z } from "zod";
import { WARDROBE_CATEGORIES } from "@stylaiize/shared";

/**
 * Signed token returned by `POST /wardrobe/upload` and `POST /wardrobe/categorize`.
 * The storage `publicId` is resolved from it server-side, so clients never send
 * a raw provider id.
 */
const imageUploadToken = z
  .string()
  .trim()
  .min(1)
  .max(1024)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, "Malformed image upload token.")
  .nullable()
  .optional();

export const createWardrobeItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  category: z.enum(WARDROBE_CATEGORIES),
  color: z.string().trim().min(1, "Color is required.").max(50),
  imageUrl: z.string().url().nullable().optional(),
  imageUploadToken,
  brand: z.string().trim().max(100).nullable().optional(),
  purchasedPrice: z.number().min(0).nullable().optional(),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
});

export const updateWardrobeItemSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  category: z.enum(WARDROBE_CATEGORIES).optional(),
  color: z.string().trim().min(1).max(50).optional(),
  imageUrl: z.string().url().nullable().optional(),
  imageUploadToken,
  brand: z.string().trim().max(100).nullable().optional(),
  purchasedPrice: z.number().min(0).nullable().optional(),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
});

export const listWardrobeQuerySchema = z.object({
  category: z.enum(WARDROBE_CATEGORIES).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sort: z
    .enum(["newest", "oldest", "name", "mostWorn", "leastWorn", "price"])
    .optional(),
});

export type CreateWardrobeItemSchemaInput = z.infer<typeof createWardrobeItemSchema>;
export type UpdateWardrobeItemSchemaInput = z.infer<typeof updateWardrobeItemSchema>;
export type ListWardrobeQuerySchemaInput = z.infer<typeof listWardrobeQuerySchema>;
