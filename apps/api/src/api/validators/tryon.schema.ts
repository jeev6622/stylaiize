import { z } from "zod";
import { OUTFIT_ITEM_TYPES } from "@stylaiize/shared";
import { env } from "@/config/env";

const MAX_IMAGE_CHARS = Math.ceil((env.VTON_MAX_IMAGE_BYTES * 4) / 3) + 64;

const inlineImage = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(MAX_IMAGE_CHARS, `${label} payload is too large.`)
    .refine(
      (value) =>
        /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value) ||
        /^[A-Za-z0-9+/]+={0,2}$/.test(value),
      `${label} must be inline base64 image data. Remote image URLs are not accepted.`,
    );

export const tryOnSchema = z.object({
  personImage: inlineImage("A person photo"),
  garmentImage: inlineImage("A garment photo"),
  category: z.enum(OUTFIT_ITEM_TYPES).optional(),
  garmentLabel: z.string().trim().max(160).optional(),
});

export type TryOnSchemaInput = z.infer<typeof tryOnSchema>;

export const saveTryOnSchema = z.object({
  resultId: z.string().trim().min(1, "Result id is required."),
});

export const saveTryOnAsOutfitSchema = z.object({
  resultId: z.string().trim().min(1, "Result id is required."),
  name: z.string().trim().max(160).optional(),
  category: z.string().trim().max(40).optional(),
  occasion: z.string().trim().max(120).nullable().optional(),
  style: z.string().trim().max(120).nullable().optional(),
  colors: z.array(z.string().trim().max(60)).max(20).optional(),
  budget: z.number().min(0).nullable().optional(),
});

export const saveTryOnToWardrobeSchema = z.object({
  resultId: z.string().trim().min(1, "Result id is required."),
  name: z.string().trim().max(160).optional(),
  category: z.string().trim().max(40).optional(),
  color: z.string().trim().max(50).optional(),
  brand: z.string().trim().max(100).nullable().optional(),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
});