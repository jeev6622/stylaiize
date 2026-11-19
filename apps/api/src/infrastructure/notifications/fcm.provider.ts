import { env } from "@/config/env";
import { logError, logInfo } from "@/utils/logger";
import type {
  NotificationProviderPort,
  NotificationPayload,
  NotificationResult,
} from "./notification.interface";

interface FCMTokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: FCMTokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: env.FCM_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");

  const { createSign } = await import("node:crypto");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(env.FCM_PRIVATE_KEY, "base64url");

  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`FCM token request failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return tokenCache.token;
}

export class FCMNotificationProvider implements NotificationProviderPort {
  readonly demoMode = false;

  get isConfigured(): boolean {
    return env.FCM_SERVER_KEY.trim().length > 0;
  }

  async sendPush(payload: NotificationPayload, deviceTokens: string[]): Promise<NotificationResult> {
    if (!this.isConfigured || deviceTokens.length === 0) {
      return { success: false, error: "FCM not configured or no device tokens" };
    }

    try {
      const accessToken = await getAccessToken();
      const projectId = env.FCM_PROJECT_ID;
      let lastMessageId: string | undefined;

      for (const token of deviceTokens) {
        const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: payload.title, body: payload.body },
              data: {
                type: payload.type,
                ...(payload.data ?? {}),
                ...(payload.url ? { url: payload.url } : {}),
              },
              webpush: payload.url ? { fcmOptions: { link: payload.url } } : undefined,
            },
          }),
        });

        if (res.ok) {
          const result = (await res.json()) as { name?: string };
          lastMessageId = result.name;
        }
      }

      logInfo(
        `[FCM] Sent "${payload.type}" to ${deviceTokens.length} device(s) for user ${payload.userId}`,
      );
      return { success: true, messageId: lastMessageId };
    } catch (err) {
      logError("FCM push notification failed", err);
      return { success: false, error: String(err) };
    }
  }

  async sendBulk(
    payloads: Array<NotificationPayload & { deviceTokens: string[] }>,
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    for (const p of payloads) {
      results.push(await this.sendPush(p, p.deviceTokens));
    }
    return results;
  }
}
