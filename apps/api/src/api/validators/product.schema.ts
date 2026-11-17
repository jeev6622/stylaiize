import { z } from "zod";

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
});

export const compareProductsSchema = z.object({
  productIds: z
    .array(z.string())
    .min(2, "At least 2 products required.")
    .max(5, "Maximum 5 products."),
});

export type SearchProductsInput = z.infer<typeof searchProductsSchema>;
export type CompareProductsInput = z.infer<typeof compareProductsSchema>;
