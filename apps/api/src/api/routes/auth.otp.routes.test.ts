import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import * as authService from "@/application/services/auth.service";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { registerDemoPendingRegistrationRepository } from "@/infrastructure/repos/pending-registration.repo";
import { InMemoryPendingRegistrationRepository } from "@/infrastructure/repos/memory/pending-registration.memory.repo";
import { registerDemoOTPRepository } from "@/infrastructure/repos/otp.repo";
import { InMemoryOTPRepository } from "@/infrastructure/repos/memory/otp.memory.repo";
import { registerDemoRefreshTokenRepository } from "@/infrastructure/repos/refresh-token.repo";
import { InMemoryRefreshTokenRepository } from "@/infrastructure/repos/memory/refresh-token.memory.repo";

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
const PASSWORD = "Str0ng!Passw0rd";
const COUNTRY_CODE = "+91";

let userRepository: InMemoryUserRepository;
let pendingRegistrationRepository: InMemoryPendingRegistrationRepository;
let refreshTokenRepository: InMemoryRefreshTokenRepository;
let userCounter = 0;

function nextEmail(): string {
  userCounter += 1;
  return `otp-${userCounter}@example.com`;
}

function nextMobile(): string {
  return `9${String(userCounter).padStart(9, "0")}`;
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

async function register(email = nextEmail()) {
  const mobile = nextMobile();
  const started = await request(app)
    .post("/api/v1/auth/register/start")
    .send({
      name: "OTP User",
      email,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      mobile,
      countryCode: COUNTRY_CODE,
    });
  expect(started.status).toBe(201);

  const registrationId = started.body.data.registrationId as string;
  expect(registrationId).toBeTruthy();

  const emailCode = codeForEmail(email);
  const mobileCode = codeForMobile(mobile);
  expect(emailCode).toMatch(/^\d{6}$/);
  expect(mobileCode).toMatch(/^\d{6}$/);

  const emailVerification = await request(app)
    .post("/api/v1/auth/register/verify")
    .send({ registrationId, channel: "email", code: emailCode });
  expect(emailVerification.status).toBe(200);

  const mobileVerification = await request(app)
    .post("/api/v1/auth/register/verify")
    .send({ registrationId, channel: "mobile", code: mobileCode });
  expect(mobileVerification.status).toBe(200);

  const completed = await request(app)
    .post("/api/v1/auth/register")
    .send({ registrationId });
  expect(completed.status).toBe(201);

  return { email, mobile, ...completed.body.data };
}

beforeAll(() => {
  registerDemoOTPRepository(new InMemoryOTPRepository());
});

beforeEach(() => {
  userCounter = 0;
  userRepository = new InMemoryUserRepository();
  registerDemoUserRepository(userRepository);
  pendingRegistrationRepository = new InMemoryPendingRegistrationRepository();
  registerDemoPendingRegistrationRepository(pendingRegistrationRepository);
  registerDemoOTPRepository(new InMemoryOTPRepository());
  refreshTokenRepository = new InMemoryRefreshTokenRepository();
  registerDemoRefreshTokenRepository(refreshTokenRepository);
  emailMocks.active = true;
  emailMocks.send.mockReset();
  emailMocks.send.mockResolvedValue({ success: true });
  smsMocks.active = true;
  smsMocks.send.mockReset();
  smsMocks.send.mockResolvedValue({ success: true });
});

describe("email OTP login routes", () => {
  it("authenticates an existing user, persists the session, and verifies the email", async () => {
    const account = await register();
    const text = JSON.stringify(
      (await request(app)
        .post("/api/v1/auth/otp/login/request")
        .send({ email: account.email })).body,
    );
    expect(text).not.toMatch(/\b\d{6}\b/);
    expect(text).not.toContain("target");

    const code = codeForEmail(account.email);
    expect(code).toMatch(/^\d{6}$/);

    const verified = await request(app)
      .post("/api/v1/auth/otp/login/verify")
      .send({ email: account.email, code, rememberMe: true });
    expect(verified.status).toBe(200);
    expect(verified.body.data.accessToken).toBeTruthy();
    expect(verified.body.data.refreshToken).toBeTruthy();

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${verified.body.data.accessToken}`);
    expect(me.status).toBe(200);

    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: verified.body.data.refreshToken });
    expect(refreshed.status).toBe(200);

    const stored = await userRepository.findByEmail(account.email);
    expect(stored?.emailVerified).toBe(true);
    expect(stored?.mobileVerified).toBe(true);
    expect(stored?.providers).toContain("email");
  });

  it("returns a generic response and creates no account for an unknown email", async () => {
    const before = await userRepository.count();
    const email = "does-not-exist@example.com";

    const response = await request(app)
      .post("/api/v1/auth/otp/login/request")
      .send({ email });

    expect(response.status).toBe(200);
    expect(response.body.data.success).toBe(true);
    expect(response.body.data.target).toBeUndefined();
    expect(emailMocks.send).not.toHaveBeenCalled();
    expect(await userRepository.count()).toBe(before);
  });

  it("reports unavailable email delivery without claiming success", async () => {
    const account = await register();
    emailMocks.send.mockClear();
    emailMocks.active = false;

    const response = await request(app)
      .post("/api/v1/auth/otp/login/request")
      .send({ email: account.email });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("EMAIL_DELIVERY_UNAVAILABLE");
    expect(emailMocks.send).not.toHaveBeenCalled();
  });

  it("rejects an invalid sign-in code without issuing tokens", async () => {
    const account = await register();
    await request(app)
      .post("/api/v1/auth/otp/login/request")
      .send({ email: account.email });
    const code = codeForEmail(account.email);
    const wrong = code === "000000" ? "111111" : "000000";

    const response = await request(app)
      .post("/api/v1/auth/otp/login/verify")
      .send({ email: account.email, code: wrong });

    expect(response.status).toBe(401);
    expect(response.body.data).toBeUndefined();
  });

  it("keeps password login working", async () => {
    const account = await register();

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: account.email, password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeTruthy();
  });

  it("keeps Google login working and links the verified email", async () => {
    const account = await register();

    const result = await authService.loginWithGoogleProfile({
      sub: `google-${userCounter}`,
      email: account.email,
      email_verified: true,
      name: "Google User",
    });

    expect(result.accessToken).toBeTruthy();
    const stored = await userRepository.findByEmail(account.email);
    expect(stored?.googleId).toBe(`google-${userCounter}`);
    expect(stored?.providers).toContain("google");
  });
});

describe("mobile OTP routes", () => {
  it("delivers a code through the configured SMS provider", async () => {
    const response = await request(app)
      .post("/api/v1/auth/otp/send")
      .send({ purpose: "login", countryCode: COUNTRY_CODE, mobile: "9876543210" });

    expect(response.status).toBe(200);
    expect(response.body.data.success).toBe(true);
    expect(smsMocks.send).toHaveBeenCalledTimes(1);
    expect(smsMocks.send.mock.calls[0]?.[0].to).toBe("9876543210");
    expect(smsMocks.send.mock.calls[0]?.[0].body).toMatch(/\b\d{6}\b/);
  });
});
