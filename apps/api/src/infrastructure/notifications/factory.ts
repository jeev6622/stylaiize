import { isDemoModeAllowed } from "@/config/features";
import { logInfo } from "@/utils/logger";
import { FCMNotificationProvider } from "./fcm.provider";
import { MockNotificationProvider } from "./mock-notification.provider";
import type {
  NotificationProviderPort,
  NotificationResult,
} from "./notification.interface";

const NOT_CONFIGURED =
  "Push notifications are not configured. Set FCM credentials or enable ALLOW_DEMO_MODE.";

const disabledProvider: NotificationProviderPort = {
  isConfigured: false,
  demoMode: false,
  async sendPush(): Promise<NotificationResult> {
    return { success: false, error: NOT_CONFIGURED };
  },
  async sendBulk(payloads): Promise<NotificationResult[]> {
    return payloads.map(() => ({ success: false, error: NOT_CONFIGURED }));
  },
};

let cached: NotificationProviderPort | null = null;

export function resolveNotificationProvider(): NotificationProviderPort {
  if (cached) return cached;
  const fcm = new FCMNotificationProvider();
  if (fcm.isConfigured) {
    cached = fcm;
  } else if (isDemoModeAllowed()) {
    cached = new MockNotificationProvider();
  } else {
    cached = disabledProvider;
  }
  logInfo(
    `Notification provider resolved: ${cached.demoMode ? "mock (demo, not delivered)" : cached.isConfigured ? "fcm" : "disabled"}`,
  );
  return cached;
}

export function notificationProviderStatus(): { active: boolean; demoMode: boolean } {
  const provider = resolveNotificationProvider();
  return {
    active: provider.isConfigured && !provider.demoMode,
    demoMode: provider.demoMode,
  };
}

export function resetNotificationProvider(): void {
  cached = null;
}
