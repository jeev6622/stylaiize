import { z } from "zod";
import { SHOP_AUDIENCES } from "@stylaiize/shared";

const productIdSchema = z
  .string()
  .trim()
  .min(1, "Product id is required.")
  .max(100, "Product id is too long.")
  .regex(/^[A-Za-z0-9_:-]+$/, "Product id has an invalid format.");

export const searchProductsSchema = z.object({
  query: z.string().trim().min(1, "Search query is required.").max(200),
  category: z.string().trim().max(50).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sortBy: z
    .enum(["relevance", "price_asc", "price_desc", "rating", "discount"])
    .optional()
    .default("relevance"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
  pinCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a valid 6-digit PIN code.")
    .optional(),
  audience: z.enum(SHOP_AUDIENCES).optional(),
  style: z.string().trim().max(80).optional(),
});

export const productModel3dQuerySchema = z.object({
  url: z
    .string()
    .trim()
    .max(2000, "Model URL is too long.")
    .url("Enter a valid model URL.")
    .refine((value) => value.startsWith("https://"), "Model URL must use HTTPS.")
    .refine((value) => /\.glb(?:\?|#|$)/i.test(value), "Only GLB product models are supported."),
});

export const compareProductsSchema = z.object({
  productIds: z
    .array(productIdSchema)
    .min(2, "At least 2 products required.")
    .max(5, "Maximum 5 products."),
});

export type SearchProductsInput = z.infer<typeof searchProductsSchema>;
export type ProductModel3dQuery = z.infer<typeof productModel3dQuerySchema>;
export type CompareProductsInput = z.infer<typeof compareProductsSchema>;
