import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/config/env";
import {
  notificationProviderStatus,
  resetNotificationProvider,
  resolveNotificationProvider,
} from "@/infrastructure/notifications/factory";

const originalDemo = env.ALLOW_DEMO_MODE;
const originalNodeEnv = env.NODE_ENV;
const originalFcmKey = env.FCM_SERVER_KEY;

afterEach(() => {
  env.ALLOW_DEMO_MODE = originalDemo;
  env.NODE_ENV = originalNodeEnv;
  env.FCM_SERVER_KEY = originalFcmKey;
  resetNotificationProvider();
});

describe("Notification provider resolution", () => {
  it("uses the mock provider only with an explicit demo opt-in", () => {
    env.NODE_ENV = "production";
    env.FCM_SERVER_KEY = "";
    env.ALLOW_DEMO_MODE = true;
    const provider = resolveNotificationProvider();
    expect(provider.demoMode).toBe(true);
    expect(notificationProviderStatus()).toEqual({ active: false, demoMode: true });
  });

  it("reports failure instead of fake delivery when FCM is unconfigured", async () => {
    env.NODE_ENV = "production";
    env.FCM_SERVER_KEY = "";
    env.ALLOW_DEMO_MODE = false;
    const provider = resolveNotificationProvider();
    expect(provider.isConfigured).toBe(false);
    expect(notificationProviderStatus()).toEqual({ active: false, demoMode: false });

    const result = await provider.sendPush(
      { userId: "u1", type: "price_drop", title: "Drop", body: "Price dropped" },
      ["device-token"],
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not configured/i);
  });
});
