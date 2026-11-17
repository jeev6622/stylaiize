import { logInfo } from "@/utils/logger";
import { FCMNotificationProvider } from "./fcm.provider";
import { MockNotificationProvider } from "./mock-notification.provider";
import type { NotificationProviderPort } from "./notification.interface";

let cached: NotificationProviderPort | null = null;

export function resolveNotificationProvider(): NotificationProviderPort {
  if (cached) return cached;
  const fcm = new FCMNotificationProvider();
  cached = fcm.isConfigured ? fcm : new MockNotificationProvider();
  logInfo(
    `Notification provider resolved: ${cached.demoMode ? "mock (logging)" : "fcm"}`,
  );
  return cached;
}

export function notificationProviderStatus(): { active: boolean; demoMode: boolean } {
  const provider = resolveNotificationProvider();
  return { active: !provider.demoMode, demoMode: provider.demoMode };
}

export function resetNotificationProvider(): void {
  cached = null;
}
