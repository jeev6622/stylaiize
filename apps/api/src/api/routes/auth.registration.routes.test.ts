import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { registerDemoPendingRegistrationRepository } from "@/infrastructure/repos/pending-registration.repo";
import { InMemoryPendingRegistrationRepository } from "@/infrastructure/repos/memory/pending-registration.memory.repo";
import { registerDemoOTPRepository } from "@/infrastructure/repos/otp.repo";
import { InMemoryOTPRepository } from "@/infrastructure/repos/memory/otp.memory.repo";
import { registerDemoRefreshTokenRepository } from "@/infrastructure/repos/refresh-token.repo";
import { InMemoryRefreshTokenRepository } from "@/infrastructure/repos/memory/refresh-token.memory.repo";

const PASSWORD = "Str0ng!Passw0rd";
const COUNTRY_CODE = "+91";

const emailMocks = vi.hoisted(() => ({
  active: true,
  send: vi.fn(
    async (_input: { to: string; subject: string; text: string; html?: string }) => ({
      success: true as boolean,
      error: undefined as string | undefined,
    }),
  ),
}));

const smsMocks = vi.hoisted(() => ({
  active: true,
  send: vi.fn(
    async (_input: { to: string; body: string }) => ({
      success: true as boolean,
      error: undefined as string | undefined,
    }),
  ),
}));

vi.mock("@/infrastructure/email/factory", () => ({
  resolveEmailProvider: () => ({
    isConfigured: emailMocks.active,
    demoMode: false,
    send: emailMocks.send,
  }),
  emailProviderStatus: () => ({ active: emailMocks.active, demoMode: false }),
  resetEmailProvider: vi.fn(),
  registerEmailProviderForTests: vi.fn(),
}));

vi.mock("@/infrastructure/sms/factory", () => ({
  SMS_DELIVERY_UNAVAILABLE: "SMS delivery is not configured.",
  resolveSmsProvider: () => ({
    isConfigured: smsMocks.active,
    demoMode: false,
    send: smsMocks.send,
  }),
  smsProviderStatus: () => ({ active: smsMocks.active, demoMode: false }),
  resetSmsProvider: vi.fn(),
  registerSmsProviderForTests: vi.fn(),
}));

const app = createApp();

let userRepository: InMemoryUserRepository;
let pendingRegistrationRepository: InMemoryPendingRegistrationRepository;
let userCounter = 0;

type RegistrationPayload = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  mobile: string;
  countryCode: string;
};

function makePayload(overrides: Partial<RegistrationPayload> = {}): RegistrationPayload {
  userCounter += 1;
  return {
    name: `Register ${userCounter}`,
    email: `register-${userCounter}@example.com`,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    mobile: `9${String(userCounter).padStart(9, "0")}`,
    countryCode: COUNTRY_CODE,
    ...overrides,
  };
}

function codeForEmail(email: string): string {
  const call = [...emailMocks.send.mock.calls]
    .reverse()
    .find(([input]) => input.to === email);
  return call?.[0].text.match(/\b\d{6}\b/)?.[0] ?? "";
}

function codeForMobile(mobile: string): string {
  const call = [...smsMocks.send.mock.calls]
    .reverse()
    .find(([input]) => input.to === mobile);
  return call?.[0].body.match(/\b\d{6}\b/)?.[0] ?? "";
}

async function start(payload = makePayload()) {
  const response = await request(app).post("/api/v1/auth/register/start").send(payload);
  return { payload, response, registrationId: response.body.data?.registrationId as string | undefined };
}

function verify(registrationId: string, channel: "email" | "mobile", code: string) {
  return request(app)
    .post("/api/v1/auth/register/verify")
    .send({ registrationId, channel, code });
}

function complete(registrationId: string) {
  return request(app).post("/api/v1/auth/register").send({ registrationId });
}

beforeEach(() => {
  userCounter = 0;
  userRepository = new InMemoryUserRepository();
  registerDemoUserRepository(userRepository);
  pendingRegistrationRepository = new InMemoryPendingRegistrationRepository();
  registerDemoPendingRegistrationRepository(pendingRegistrationRepository);
  registerDemoOTPRepository(new InMemoryOTPRepository());
  registerDemoRefreshTokenRepository(new InMemoryRefreshTokenRepository());
  emailMocks.active = true;
  emailMocks.send.mockReset();
  emailMocks.send.mockResolvedValue({ success: true });
  smsMocks.active = true;
  smsMocks.send.mockReset();
  smsMocks.send.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("verified registration routes", () => {
  it("creates a verified account only after both OTPs are verified", async () => {
    const { payload, response, registrationId } = await start();
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      email: payload.email,
      mobile: payload.mobile,
      expiresAt: expect.any(String),
      resendAvailableAt: expect.any(String),
    });
    expect(response.body.data.passwordHash).toBeUndefined();
    expect(response.body.data.code).toBeUndefined();
    expect(registrationId).toBeTruthy();

    const emailVerification = await verify(registrationId!, "email", codeForEmail(payload.email));
    expect(emailVerification.status).toBe(200);
    expect(emailVerification.body.data).toEqual({
      channel: "email",
      verified: true,
      bothVerified: false,
    });

    const mobileVerification = await verify(registrationId!, "mobile", codeForMobile(payload.mobile));
    expect(mobileVerification.status).toBe(200);
    expect(mobileVerification.body.data).toEqual({
      channel: "mobile",
      verified: true,
      bothVerified: true,
    });

    const completed = await complete(registrationId!);
    expect(completed.status).toBe(201);
    expect(completed.body.data.accessToken).toBeTruthy();
    expect(completed.body.data.refreshToken).toBeTruthy();
    expect(completed.body.data.user).toMatchObject({
      email: payload.email,
      mobile: payload.mobile,
      emailVerified: true,
      mobileVerified: true,
    });

    expect(await userRepository.count()).toBe(1);
    expect(await pendingRegistrationRepository.findById(registrationId!)).toBeNull();
  });

  it("rejects invalid email, invalid mobile, weak password, and mismatched confirmation", async () => {
    const invalidCases = [
      makePayload({ email: "not-an-email" }),
      makePayload({ mobile: "1234567890" }),
      makePayload({ mobile: "987654321", countryCode: "+91" }),
      makePayload({ password: "password", confirmPassword: "password" }),
      makePayload({ confirmPassword: "Different1!" }),
    ];

    for (const payload of invalidCases) {
      const response = await start(payload);
      expect(response.response.status).toBe(422);
      expect(response.response.body.error.code).toBe("VALIDATION_ERROR");
    }

    expect(emailMocks.send).not.toHaveBeenCalled();
    expect(smsMocks.send).not.toHaveBeenCalled();
    expect(await userRepository.count()).toBe(0);
  });

  it("rejects duplicate email and mobile addresses before sending codes", async () => {
    const first = await start();
    expect(first.response.status).toBe(201);

    const duplicateEmail = await start(makePayload({ email: first.payload.email }));
    expect(duplicateEmail.response.status).toBe(409);
    expect(duplicateEmail.response.body.error.code).toBe("EMAIL_TAKEN");

    const duplicateMobile = await start(makePayload({ mobile: first.payload.mobile }));
    expect(duplicateMobile.response.status).toBe(409);
    expect(duplicateMobile.response.body.error.code).toBe("MOBILE_TAKEN");

    expect(await userRepository.count()).toBe(0);
  });

  it("does not create an account until both channels are verified", async () => {
    const { payload, registrationId } = await start();
    const emailVerification = await verify(registrationId!, "email", codeForEmail(payload.email));
    expect(emailVerification.status).toBe(200);

    const earlyComplete = await complete(registrationId!);
    expect(earlyComplete.status).toBe(403);
    expect(earlyComplete.body.error.code).toBe("REGISTRATION_NOT_VERIFIED");
    expect(await userRepository.count()).toBe(0);
    expect(await pendingRegistrationRepository.findById(registrationId!)).not.toBeNull();

    const mobileVerification = await verify(registrationId!, "mobile", codeForMobile(payload.mobile));
    expect(mobileVerification.status).toBe(200);
    expect((await complete(registrationId!)).status).toBe(201);
  });

  it("rejects an incorrect OTP without creating an account", async () => {
    const { payload, registrationId } = await start();
    const code = codeForEmail(payload.email);
    const wrong = code === "000000" ? "111111" : "000000";

    const response = await verify(registrationId!, "email", wrong);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_OTP");
    expect(await userRepository.count()).toBe(0);
  });

  it("rejects reuse of an already verified channel", async () => {
    const { payload, registrationId } = await start();
    const code = codeForEmail(payload.email);
    expect((await verify(registrationId!, "email", code)).status).toBe(200);

    const response = await verify(registrationId!, "email", code);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("ALREADY_VERIFIED");
  });

  it("enforces the resend cooldown and allows resending after it expires", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { registrationId } = await start();

    const early = await request(app)
      .post("/api/v1/auth/register/resend")
      .send({ registrationId, channel: "email" });
    expect(early.status).toBe(429);
    expect(early.body.error.code).toBe("OTP_RESEND_COOLDOWN");

    vi.setSystemTime(new Date(Date.now() + 61_000));
    const late = await request(app)
      .post("/api/v1/auth/register/resend")
      .send({ registrationId, channel: "email" });
    expect(late.status).toBe(200);
    expect(late.body.data).toEqual({
      channel: "email",
      resendAvailableAt: expect.any(String),
    });
  });

  it("expires codes after five minutes and accepts a fresh resent code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { payload, registrationId } = await start();

    vi.setSystemTime(new Date("2026-01-01T00:05:01.000Z"));
    const expired = await verify(registrationId!, "email", codeForEmail(payload.email));
    expect(expired.status).toBe(400);
    expect(expired.body.error.code).toBe("OTP_EXPIRED");

    const resent = await request(app)
      .post("/api/v1/auth/register/resend")
      .send({ registrationId, channel: "email" });
    expect(resent.status).toBe(200);

    const verified = await verify(registrationId!, "email", codeForEmail(payload.email));
    expect(verified.status).toBe(200);
  });

  it("expires a registration session after ten minutes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { registrationId } = await start();

    vi.setSystemTime(new Date("2026-01-01T00:10:01.000Z"));
    const response = await complete(registrationId!);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("REGISTRATION_EXPIRED");
    expect(await userRepository.count()).toBe(0);
  });

  it("requires both email and SMS providers to be configured", async () => {
    emailMocks.active = false;
    const noEmail = await start();
    expect(noEmail.response.status).toBe(503);
    expect(noEmail.response.body.error.code).toBe("EMAIL_DELIVERY_UNAVAILABLE");

    emailMocks.active = true;
    smsMocks.active = false;
    const noSms = await start();
    expect(noSms.response.status).toBe(503);
    expect(noSms.response.body.error.code).toBe("SMS_DELIVERY_UNAVAILABLE");

    expect(await pendingRegistrationRepository.findByEmail(noEmail.payload.email)).toBeNull();
    expect(await pendingRegistrationRepository.findByEmail(noSms.payload.email)).toBeNull();
    expect(await userRepository.count()).toBe(0);
  });
});
