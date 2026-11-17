import { logInfo } from "@/utils/logger";
import type {
  NotificationProviderPort,
  NotificationPayload,
  NotificationResult,
} from "./notification.interface";

export class MockNotificationProvider implements NotificationProviderPort {
  readonly isConfigured = true;
  readonly demoMode = true;

  async sendPush(
    payload: NotificationPayload,
    deviceTokens: string[],
  ): Promise<NotificationResult> {
    logInfo(
      `[NOTIFICATION-MOCK] To user ${payload.userId} (${deviceTokens.length} devices): [${payload.type}] ${payload.title}: ${payload.body}`,
    );
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  async sendBulk(
    payloads: Array<NotificationPayload & { deviceTokens: string[] }>,
  ): Promise<NotificationResult[]> {
    return Promise.all(payloads.map((p) => this.sendPush(p, p.deviceTokens)));
  }
}
