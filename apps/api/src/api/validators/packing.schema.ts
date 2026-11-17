import { z } from "zod";
import { PACKING_CATEGORIES } from "@stylaiize/shared";

export const createPackingListSchema = z.object({
  title: z.string().trim().min(1).max(200),
  destination: z.string().trim().min(1).max(200),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export const generatePackingListSchema = z.object({
  destination: z.string().trim().min(1).max(200),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  activities: z.array(z.string().trim().max(100)).max(10).optional(),
});

export const updatePackingListSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  destination: z.string().trim().min(1).max(200).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  items: z.array(z.object({
    id: z.string(),
    name: z.string().trim().min(1),
    category: z.enum(PACKING_CATEGORIES),
    quantity: z.number().int().min(1).max(99),
    essential: z.boolean(),
    packed: z.boolean().default(false),
  })).optional(),
});

export type CreatePackingListSchemaInput = z.infer<typeof createPackingListSchema>;
export type GeneratePackingListSchemaInput = z.infer<typeof generatePackingListSchema>;
export type UpdatePackingListSchemaInput = z.infer<typeof updatePackingListSchema>;
