import type { NotificationType } from "@stylaiize/shared";
import { resolveNotificationProvider, notificationProviderStatus } from "@/infrastructure/notifications/factory";
import type {
  NotificationPayload,
  NotificationResult,
} from "@/infrastructure/notifications/notification.interface";

interface SendNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
  deviceTokens?: string[];
}

export async function sendNotification(
  input: SendNotificationInput,
): Promise<NotificationResult> {
  const provider = resolveNotificationProvider();

  if (!input.deviceTokens || input.deviceTokens.length === 0) {
    return { success: false, error: "No device tokens provided" };
  }

  const payload: NotificationPayload = {
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    url: input.url,
    data: input.data,
  };

  return provider.sendPush(payload, input.deviceTokens);
}

export async function sendBulkNotifications(
  notifications: SendNotificationInput[],
): Promise<NotificationResult[]> {
  const provider = resolveNotificationProvider();

  const payloads = notifications
    .filter((n) => n.deviceTokens && n.deviceTokens.length > 0)
    .map((n) => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      url: n.url,
      data: n.data,
      deviceTokens: n.deviceTokens!,
    }));

  return provider.sendBulk(payloads);
}

/** Whether push delivery is live (real FCM), demo-only, or unavailable. */
export function notificationStatus(): { active: boolean; demoMode: boolean } {
  return notificationProviderStatus();
}
