import type { NotificationType, PriceAlert } from "@stylaiize/shared";
import { priceAlertRepository } from "@/infrastructure/repos/price-alert.repo";
import { userRepository } from "@/infrastructure/repos/user.repo";
import type { CreatePriceAlertInput } from "@/domain/ports/repositories";
import { NotFoundError } from "@/utils/errors";
import { logInfo } from "@/utils/logger";
import * as productService from "@/application/services/product.service";
import { sendNotification } from "@/application/services/notification.service";

export async function createAlert(input: CreatePriceAlertInput): Promise<PriceAlert> {
  return priceAlertRepository().create(input);
}

export async function getAlerts(userId: string): Promise<PriceAlert[]> {
  return priceAlertRepository().findByUserId(userId);
}

export async function updateAlert(
  userId: string,
  alertId: string,
  patch: Partial<Pick<PriceAlert, "targetPrice" | "conditions" | "channels" | "status">>,
): Promise<PriceAlert> {
  const existing = await priceAlertRepository().findById(alertId);
  if (!existing || existing.userId !== userId) throw new NotFoundError("Price alert not found.");
  const updated = await priceAlertRepository().update(alertId, patch);
  return updated!;
}

export async function deleteAlert(userId: string, alertId: string): Promise<void> {
  const existing = await priceAlertRepository().findById(alertId);
  if (!existing || existing.userId !== userId) throw new NotFoundError("Price alert not found.");
  await priceAlertRepository().delete(alertId);
}

/** Maps the alert condition that fired onto the notification taxonomy. */
function notificationTypeFor(alert: PriceAlert): NotificationType {
  if (alert.conditions.includes("back_in_stock")) return "back_in_stock";
  if (alert.conditions.includes("discount_appears")) return "discount";
  if (alert.conditions.includes("coupon_available")) return "coupon";
  if (alert.conditions.includes("size_available")) return "size_available";
  return "price_drop";
}

/**
 * Pushes a "your alert fired" notification to every device the user has
 * registered. Delivery is best-effort and must never fail the alert check, so
 * a missing token list, an opted-out user or a provider error is swallowed
 * after being logged.
 */
async function notifyAlertTriggered(
  userId: string,
  alert: PriceAlert,
): Promise<void> {
  try {
    const user = await userRepository().findById(userId);
    const prefs = user?.preferences;
    if (!prefs) return;

    // Respect both the account-level switch and the per-alert channel choice.
    if (!prefs.pushNotifications) return;
    if (prefs.notificationChannels?.length && !prefs.notificationChannels.includes("push")) {
      return;
    }

    const deviceTokens = prefs.deviceTokens ?? [];
    if (deviceTokens.length === 0) return;

    const result = await sendNotification({
      userId,
      type: notificationTypeFor(alert),
      title: "Price alert triggered",
      body:
        alert.targetPrice !== null
          ? `An item you are watching is now at or below ${alert.targetPrice}.`
          : "An item you are watching just changed.",
      url: `/products?focus=${encodeURIComponent(alert.productId)}`,
      data: { alertId: alert.id, productId: alert.productId },
      deviceTokens,
    });

    if (!result.success) {
      logInfo(`[alerts] push not delivered for alert ${alert.id}: ${result.error ?? "unknown"}`);
    }
  } catch (err) {
    logInfo(`[alerts] notification failed for alert ${alert.id}: ${String(err)}`);
  }
}

/**
 * Compares the given user's active alerts against the live provider catalog
 * and marks any alert whose target price (or drop/stock condition) has been
 * met as triggered. Scoped to the authenticated caller so one user can never
 * trigger/scan another user's alerts.
 * Returns the number of alerts that newly triggered.
 */
export async function checkAlerts(userId: string): Promise<{ triggered: PriceAlert[] }> {
  const mine = await priceAlertRepository().findByUserId(userId);
  const active = mine.filter((alert) => alert.status === "active");
  const triggered: PriceAlert[] = [];

  for (const alert of active) {
    let shouldTrigger = false;

    try {
      const product = await productService.getProductById(alert.productId);
      if (!product) continue;

      if (alert.conditions.includes("price_drop") && alert.targetPrice !== null) {
        if (product.price <= alert.targetPrice) shouldTrigger = true;
      }
      if (alert.conditions.includes("back_in_stock") && product.inStock) shouldTrigger = true;
      if (alert.conditions.includes("discount_appears") && (product.discountPercent ?? 0) > 0) {
        shouldTrigger = true;
      }
    } catch {
      continue;
    }

    if (shouldTrigger) {
      const updated = await priceAlertRepository().update(alert.id, {
        status: "triggered",
        triggeredAt: new Date().toISOString(),
      });
      if (updated) {
        triggered.push(updated);
        await notifyAlertTriggered(userId, updated);
      }
    }
  }

  return { triggered };
}