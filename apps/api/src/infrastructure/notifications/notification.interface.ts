import type { NotificationType } from "@stylaiize/shared";

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Optional deep-link URL */
  url?: string;
  /** Optional extra data */
  data?: Record<string, string>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationProviderPort {
  readonly isConfigured: boolean;
  readonly demoMode: boolean;
  /** Send push notification to a user's device tokens */
  sendPush(payload: NotificationPayload, deviceTokens: string[]): Promise<NotificationResult>;
  /** Send bulk notifications to multiple users */
  sendBulk(payloads: Array<NotificationPayload & { deviceTokens: string[] }>): Promise<NotificationResult[]>;
}
