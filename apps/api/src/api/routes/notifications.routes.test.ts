import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { registerDemoPriceAlertRepository } from "@/infrastructure/repos/price-alert.repo";
import { InMemoryPriceAlertRepository } from "@/infrastructure/repos/memory/price-alert.memory.repo";
import { MockNotificationProvider } from "@/infrastructure/notifications/mock-notification.provider";
import { signAccessToken } from "@/utils/jwt";

/**
 * Regression coverage for the push-notification wiring. Price alerts used to
 * flip to `triggered` without ever calling the notification layer, and there
 * was no way for a client to register a device token, so the whole FCM stack
 * was unreachable.
 */

const app = createApp();

const FCM_TOKEN = "fcm-registration-token-aaaaaaaaaaaaaaaaaaaaaaaa";

let userRepository: InMemoryUserRepository;
let alertRepository: InMemoryPriceAlertRepository;
let token: string;
let userId: string;
let userCounter = 0;

beforeAll(() => {
  userRepository = new InMemoryUserRepository();
  registerDemoUserRepository(userRepository);
});

beforeEach(async () => {
  // A fresh user per test: device tokens and channel preferences are mutated
  // by these tests, so sharing one user would leak state between them.
  userCounter += 1;
  const user = await userRepository.create({
    name: `Notifier ${userCounter}`,
    email: `notify-${userCounter}@example.com`,
    emailVerified: true,
  });
  userId = user.id;
  token = signAccessToken({ sub: user.id, role: "user" });

  alertRepository = new InMemoryPriceAlertRepository();
  registerDemoPriceAlertRepository(alertRepository);
});

function auth(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function registerDevice(): Promise<void> {
  const res = await request(app)
    .post("/api/v1/account/device-tokens")
    .set(auth())
    .send({ token: FCM_TOKEN });
  expect(res.status).toBe(201);
}

/**
 * Removes the push channel again. Delivery is the intersection of the
 * account-level channel preference and the per-alert channels, so this is how a
 * user stops push delivery after registering a device.
 */
async function revokePushChannel(): Promise<void> {
  const user = await userRepository.findById(userId);
  await userRepository.update(userId, {
    preferences: {
      ...user!.preferences,
      notificationChannels: user!.preferences.notificationChannels.filter(
        (c) => c !== "push",
      ),
    },
  });
}

describe("POST /api/v1/account/device-tokens", () => {
  it("stores the token and opts the user into push", async () => {
    const res = await request(app)
      .post("/api/v1/account/device-tokens")
      .set(auth())
      .send({ token: FCM_TOKEN });

    expect(res.status).toBe(201);
    expect(res.body.data.deviceTokens).toEqual([FCM_TOKEN]);
    expect(res.body.data.pushNotifications).toBe(true);
  });

  it("is idempotent for an already-registered token", async () => {
    await registerDevice();
    const res = await request(app)
      .post("/api/v1/account/device-tokens")
      .set(auth())
      .send({ token: FCM_TOKEN });

    expect(res.status).toBe(201);
    expect(res.body.data.deviceTokens).toEqual([FCM_TOKEN]);
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/v1/account/device-tokens")
      .send({ token: FCM_TOKEN });
    expect(res.status).toBe(401);
  });

  it("rejects an implausibly short token", async () => {
    const res = await request(app)
      .post("/api/v1/account/device-tokens")
      .set(auth())
      .send({ token: "abc" });
    expect(res.status).toBe(422);
  });
});

describe("DELETE /api/v1/account/device-tokens", () => {
  it("removes a registered token", async () => {
    await registerDevice();
    const res = await request(app)
      .delete("/api/v1/account/device-tokens")
      .set(auth())
      .send({ token: FCM_TOKEN });

    expect(res.status).toBe(200);
    expect(res.body.data.deviceTokens).toEqual([]);
  });
});

describe("GET /api/v1/account/notifications/status", () => {
  it("reports the registered device count", async () => {
    const res = await request(app)
      .get("/api/v1/account/notifications/status")
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("active");
    expect(res.body.data).toHaveProperty("demoMode");
    expect(res.body.data.deviceCount).toBe(0);
  });
});

describe("POST /api/v1/alerts/check", () => {
  it("pushes a notification when a registered device's alert triggers", async () => {
    await registerDevice();

    const sendSpy = vi.spyOn(MockNotificationProvider.prototype, "sendPush");

    // prod-001 is priced at 1499, so a 2000 target is already met.
    const created = await request(app)
      .post("/api/v1/alerts")
      .set(auth())
      .send({
        productId: "prod-001",
        targetPrice: 2000,
        conditions: ["price_drop"],
        channels: ["push"],
      });
    expect(created.status).toBe(201);

    const res = await request(app).post("/api/v1/alerts/check").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.triggered).toHaveLength(1);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0].type).toBe("price_drop");
    expect(sendSpy.mock.calls[0][1]).toEqual([FCM_TOKEN]);

    sendSpy.mockRestore();
  });

  it("does not push when the user has no registered device", async () => {
    const sendSpy = vi.spyOn(MockNotificationProvider.prototype, "sendPush");

    await request(app)
      .post("/api/v1/alerts")
      .set(auth())
      .send({
        productId: "prod-001",
        targetPrice: 2000,
        conditions: ["price_drop"],
        channels: ["push"],
      });

    const res = await request(app).post("/api/v1/alerts/check").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.triggered).toHaveLength(1);
    expect(sendSpy).not.toHaveBeenCalled();

    sendSpy.mockRestore();
  });

  it("does not push when the account has revoked the push channel", async () => {
    await registerDevice();
    await revokePushChannel();

    const sendSpy = vi.spyOn(MockNotificationProvider.prototype, "sendPush");

    await request(app)
      .post("/api/v1/alerts")
      .set(auth())
      .send({
        productId: "prod-001",
        targetPrice: 2000,
        conditions: ["price_drop"],
        channels: ["push"],
      });

    const res = await request(app).post("/api/v1/alerts/check").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.triggered).toHaveLength(1);
    expect(sendSpy).not.toHaveBeenCalled();

    sendSpy.mockRestore();
  });

  it("still triggers the alert when the user has opted out of push", async () => {
    // Register (which enables the channel), then explicitly opt out.
    await registerDevice();
    const user = await userRepository.findById(userId);
    await userRepository.update(userId, {
      preferences: { ...user!.preferences, pushNotifications: false },
    });

    const sendSpy = vi.spyOn(MockNotificationProvider.prototype, "sendPush");

    await request(app)
      .post("/api/v1/alerts")
      .set(auth())
      .send({
        productId: "prod-001",
        targetPrice: 2000,
        conditions: ["price_drop"],
        channels: ["push"],
      });

    const res = await request(app).post("/api/v1/alerts/check").set(auth());

    expect(res.body.data.triggered).toHaveLength(1);
    expect(sendSpy).not.toHaveBeenCalled();

    sendSpy.mockRestore();
  });
});
