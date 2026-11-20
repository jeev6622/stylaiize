import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateOTP, verifyOTP } from "@/application/services/otp.service";
import { registerDemoOTPRepository } from "@/infrastructure/repos/otp.repo";
import { InMemoryOTPRepository } from "@/infrastructure/repos/memory/otp.memory.repo";
import { verifyOTPCode } from "@/utils/password";

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

let otpRepository: InMemoryOTPRepository;

function sentEmailCode(): string {
  const input = emailMocks.send.mock.calls[0]?.[0];
  return input?.text.match(/\b\d{6}\b/)?.[0] ?? "";
}

function sentSmsCode(): string {
  const input = smsMocks.send.mock.calls[0]?.[0];
  return input?.body.match(/\b\d{6}\b/)?.[0] ?? "";
}

beforeAll(() => {
  otpRepository = new InMemoryOTPRepository();
  registerDemoOTPRepository(otpRepository);
});

beforeEach(() => {
  otpRepository = new InMemoryOTPRepository();
  registerDemoOTPRepository(otpRepository);
  emailMocks.active = true;
  emailMocks.send.mockReset();
  emailMocks.send.mockResolvedValue({ success: true });
  smsMocks.active = true;
  smsMocks.send.mockReset();
  smsMocks.send.mockResolvedValue({ success: true });
  vi.useRealTimers();
});

describe("email OTP service", () => {
  it("generates a six-digit code and stores only its hash", async () => {
    const result = await generateOTP({ purpose: "login", email: "User@Example.com" });
    const record = await otpRepository.findActive(result.target, "login");
    const code = sentEmailCode();

    expect(result.target).toBe("user@example.com");
    expect(code).toMatch(/^\d{6}$/);
    expect(record?.codeHash).toBeTruthy();
    expect(record?.codeHash).not.toBe(code);
    expect(await verifyOTPCode(code, record?.codeHash ?? "")).toBe(true);
  });

  it("expires codes after five minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await generateOTP({ purpose: "login", email: "user@example.com" });
    const code = sentEmailCode();

    vi.setSystemTime(new Date("2026-01-01T00:05:01.000Z"));
    await expect(verifyOTP({ target: "user@example.com", code, purpose: "login" })).resolves.toEqual({
      success: false,
      reason: "expired",
    });
  });

  it("rejects incorrect codes and locks after five attempts", async () => {
    await generateOTP({ purpose: "login", email: "user@example.com" });
    const code = sentEmailCode();
    const wrong = code === "000000" ? "111111" : "000000";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        verifyOTP({ target: "user@example.com", code: wrong, purpose: "login" }),
      ).resolves.toEqual({ success: false, reason: "invalid" });
    }

    await expect(
      verifyOTP({ target: "user@example.com", code, purpose: "login" }),
    ).resolves.toEqual({ success: false, reason: "attempts_exceeded" });
  });

  it("enforces a sixty-second resend cooldown", async () => {
    await generateOTP({ purpose: "login", email: "user@example.com" });

    await expect(
      generateOTP({ purpose: "login", email: "user@example.com" }),
    ).rejects.toMatchObject({ code: "OTP_RESEND_COOLDOWN" });
  });

  it("limits OTP requests per email target", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    for (let request = 0; request < 5; request += 1) {
      await generateOTP({ purpose: "login", email: "user@example.com" });
      vi.setSystemTime(new Date(Date.now() + 61_000));
    }

    await expect(
      generateOTP({ purpose: "login", email: "user@example.com" }),
    ).rejects.toMatchObject({ code: "OTP_TARGET_RATE_LIMIT" });
  });

  it("reports provider failure and leaves no active code", async () => {
    emailMocks.send.mockResolvedValueOnce({ success: false, error: "SMTP unavailable" });

    await expect(
      generateOTP({ purpose: "login", email: "user@example.com", requireRealDelivery: true }),
    ).rejects.toMatchObject({ code: "EMAIL_DELIVERY_UNAVAILABLE" });

    await expect(
      otpRepository.findActive("user@example.com", "login"),
    ).resolves.toBeNull();
  });
});

describe("mobile OTP service", () => {
  it("delivers a six-digit code through the configured SMS provider", async () => {
    const result = await generateOTP({
      purpose: "login",
      mobile: "9876543210",
      countryCode: "+91",
    });
    const code = sentSmsCode();

    expect(result.target).toBe("+919876543210");
    expect(code).toMatch(/^\d{6}$/);
    expect(smsMocks.send).toHaveBeenCalledWith({
      to: "9876543210",
      body: expect.stringContaining(code),
    });
    expect(emailMocks.send).not.toHaveBeenCalled();
  });

  it("reports SMS provider failure and leaves no active code", async () => {
    smsMocks.send.mockResolvedValueOnce({ success: false, error: "gateway unavailable" });

    await expect(
      generateOTP({ purpose: "login", mobile: "9876543210", countryCode: "+91" }),
    ).rejects.toMatchObject({ code: "SMS_DELIVERY_UNAVAILABLE" });

    await expect(
      otpRepository.findActive("+919876543210", "login"),
    ).resolves.toBeNull();
  });
});
