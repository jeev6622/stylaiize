import { z } from "zod";
import { SHOP_AUDIENCES, SHOP_STYLE_TAGS } from "@stylaiize/shared";

const httpUrlSchema = z
  .string()
  .trim()
  .url("Must be a valid URL.")
  .max(2048)
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "URL must use http or https.");

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty.").max(120).optional(),
  avatarUrl: httpUrlSchema.nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters.")
    .max(128),
});

export const registerDeviceTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, "Device token looks too short to be an FCM token.")
    .max(4096, "Device token is too long."),
});

export const unregisterDeviceTokenSchema = z.object({
  token: z.string().trim().min(1, "Device token is required.").max(4096),
});

const deliveryEstimateSchema = z
  .object({
    min: z.number().int().min(0),
    max: z.number().int().min(0),
  })
  .nullable();

export const favouriteProductSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Product id is required.")
    .max(100)
    .regex(/^[A-Za-z0-9_:-]+$/, "Product id has an invalid format."),
  title: z.string().trim().min(1).max(300),
  brand: z.string().trim().max(120).nullable(),
  imageUrl: httpUrlSchema.nullable(),
  price: z.number().positive().finite(),
  originalPrice: z.number().positive().finite().nullable(),
  currency: z.string().trim().min(1).max(10),
  discountPercent: z.number().finite().min(0).max(100).nullable(),
  rating: z.number().finite().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0).nullable(),
  store: z.string().trim().min(1).max(120),
  deliveryEstimateDays: deliveryEstimateSchema,
  buyUrl: httpUrlSchema,
  category: z.string().trim().min(1).max(80),
  audience: z.enum(SHOP_AUDIENCES).default("all"),
  styleTags: z.array(z.enum(SHOP_STYLE_TAGS)).max(20).default([]),
  colors: z.array(z.string().trim().max(40)).max(20),
  sizes: z.array(z.string().trim().max(20)).max(30),
  inStock: z.boolean(),
});

export const saveFavouriteSchema = z.object({
  product: favouriteProductSchema,
});

export type UpdateProfileSchemaInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordSchemaInput = z.infer<typeof changePasswordSchema>;
export type RegisterDeviceTokenSchemaInput = z.infer<typeof registerDeviceTokenSchema>;
export type UnregisterDeviceTokenSchemaInput = z.infer<typeof unregisterDeviceTokenSchema>;
export type SaveFavouriteSchemaInput = z.infer<typeof saveFavouriteSchema>;
export type FavouriteProductInput = z.infer<typeof favouriteProductSchema>;
