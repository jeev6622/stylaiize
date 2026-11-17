import { z } from "zod";
import { ALERT_CHANNELS, PRICE_ALERT_CONDITIONS } from "@stylaiize/shared";

export const createAlertSchema = z.object({
  productId: z.string().trim().min(1).max(200),
  targetPrice: z.number().min(0).nullable().optional(),
  conditions: z.array(z.enum(PRICE_ALERT_CONDITIONS)).max(10).default(["price_drop"]),
  channels: z.array(z.enum(ALERT_CHANNELS)).max(5).default(["email"]),
});

export const updateAlertSchema = createAlertSchema.partial();

export type CreateAlertInput = z.infer<typeof createAlertSchema>;
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;