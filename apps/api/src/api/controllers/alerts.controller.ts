import type { Request, Response } from "express";
import { asyncHandler, created, ok } from "@/utils/async-handler";
import * as alertsService from "@/application/services/alerts.service";
import type {
  CreateAlertInput,
  UpdateAlertInput,
} from "@/api/validators/alert.schema";

/** GET /alerts — list the current user's price alerts. */
export const listAlertsController = asyncHandler(async (req: Request, res: Response) => {
  const alerts = await alertsService.getAlerts(req.user!.id);
  ok(res, { alerts });
});

/** POST /alerts — create a new price alert. */
export const createAlertController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateAlertInput;
  const alert = await alertsService.createAlert({
    userId: req.user!.id,
    productId: input.productId,
    targetPrice: input.targetPrice ?? 0,
    conditions: input.conditions,
    channels: input.channels,
  });
  created(res, { alert });
});

/** PATCH /alerts/:id — update an alert (target, conditions, channels, status). */
export const updateAlertController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as UpdateAlertInput;
  const alert = await alertsService.updateAlert(req.user!.id, req.params.id, input);
  ok(res, { alert });
});

/** DELETE /alerts/:id — delete an alert. */
export const deleteAlertController = asyncHandler(async (req: Request, res: Response) => {
  await alertsService.deleteAlert(req.user!.id, req.params.id);
  ok(res, { deleted: true });
});

/** POST /alerts/check — evaluate the caller's active alerts against current product prices. */
export const checkAlertsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await alertsService.checkAlerts(req.user!.id);
  ok(res, result);
});