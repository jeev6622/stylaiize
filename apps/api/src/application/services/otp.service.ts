import { randomInt, randomUUID } from "node:crypto";
import type { OTPPurpose, OTPRecord } from "@stylaiize/shared";
import { maskMobile } from "@stylaiize/shared";
import { otpRepository } from "@/infrastructure/repos/otp.repo";
import { emailProviderStatus, resolveEmailProvider } from "@/infrastructure/email/factory";
import { SMS_DELIVERY_UNAVAILABLE, resolveSmsProvider, smsProviderStatus } from "@/infrastructure/sms/factory";
import { burnOTPHash, hashOTP, verifyOTPCode } from "@/utils/password";
import { logInfo, logWarn } from "@/utils/logger";
import { ServiceUnavailableError, TooManyRequestsError } from "@/utils/errors";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_TARGET = 5;

export interface GenerateOTPInput {
  purpose: OTPPurpose;
  userId?: string;
  email?: string;
  mobile?: string;
  countryCode?: string;
  requireRealDelivery?: boolean;
}

export interface VerifyOTPInput {
  target: string;
  code: string;
  purpose: OTPPurpose;
  markUsed?: boolean;
  expectedUserId?: string;
}

export interface VerifyOTPResult {
  success: boolean;
  userId?: string;
  otpId?: string;
  reason?: "expired" | "invalid" | "attempts_exceeded";
}

function normalizeTarget(input: Pick<GenerateOTPInput, "email" | "mobile" | "countryCode">): string {
  if (input.email) return input.email.trim().toLowerCase();
  if (input.mobile && input.countryCode) return `${input.countryCode}${input.mobile}`;
  return "";
}

export async function generateOTP(input: GenerateOTPInput): Promise<{ target: string; otpId: string }> {
  const target = normalizeTarget(input);
  if (!target) {
    throw new ServiceUnavailableError("A valid OTP target is required.", "INVALID_OTP_TARGET");
  }

  const repo = otpRepository();
  const now = Date.now();
  const active = await repo.findActive(target, input.purpose);
  if (active && now - new Date(active.createdAt).getTime() < RESEND_COOLDOWN_MS) {
    throw new TooManyRequestsError(
      "Please wait before requesting another code.",
      "OTP_RESEND_COOLDOWN",
    );
  }

  const recentCount = await repo.countRecentForTarget(
    target,
    input.purpose,
    new Date(now - OTP_REQUEST_WINDOW_MS),
  );
  if (recentCount >= MAX_REQUESTS_PER_TARGET) {
    throw new TooManyRequestsError(
      "Too many codes requested. Please try again later.",
      "OTP_TARGET_RATE_LIMIT",
    );
  }

  if (input.email && input.requireRealDelivery && !emailProviderStatus().active) {
    throw new ServiceUnavailableError(
      "Email delivery is currently unavailable.",
      "EMAIL_DELIVERY_UNAVAILABLE",
    );
  }
  if (input.mobile && !smsProviderStatus().active) {
    throw new ServiceUnavailableError(SMS_DELIVERY_UNAVAILABLE, "SMS_DELIVERY_UNAVAILABLE");
  }

  const code = generateCode();
  const codeHash = await hashOTP(code);
  const record: OTPRecord = {
    id: randomUUID(),
    target,
    userId: input.userId ?? null,
    email: input.email?.trim().toLowerCase() ?? null,
    mobile: input.mobile ?? null,
    countryCode: input.countryCode ?? null,
    codeHash,
    purpose: input.purpose,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    expiresAt: new Date(now + OTP_EXPIRY_MS).toISOString(),
    usedAt: null,
    createdAt: new Date(now).toISOString(),
  };

  await repo.invalidateActiveForTarget(target, input.purpose);
  await repo.create(record);
  await repo.deleteExpired();

  if (input.email) {
    await deliverEmailCode(input.email, input.purpose, code, record.id, repo);
  } else if (input.mobile) {
    await deliverSmsCode(input.mobile, input.purpose, code, record.id, repo);
  }

  logInfo(`[OTP] ${input.purpose} code generated for ${maskTarget(target)}`);
  return { target, otpId: record.id };
}

export async function verifyOTP(input: VerifyOTPInput): Promise<VerifyOTPResult> {
  const repo = otpRepository();
  const target = input.target.trim().toLowerCase();
  const record = await repo.findByTarget(target, input.purpose);
  const invalid: VerifyOTPResult = { success: false, reason: "invalid" };

  if (!record) {
    await burnOTPHash(input.code);
    return invalid;
  }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    await burnOTPHash(input.code);
    return { success: false, reason: "expired" };
  }
  if (record.attempts >= record.maxAttempts) {
    await burnOTPHash(input.code);
    return { success: false, reason: "attempts_exceeded" };
  }
  if (input.expectedUserId && record.userId !== input.expectedUserId) {
    await burnOTPHash(input.code);
    return invalid;
  }

  const matches = await verifyOTPCode(input.code, record.codeHash);
  if (!matches) {
    await repo.incrementAttemptsIfActive(record.id);
    return invalid;
  }

  const consumed = input.expectedUserId
    ? await repo.consumeForOwner(record.id, input.expectedUserId)
    : input.markUsed === false
      ? true
      : await repo.consume(record.id);
  if (!consumed) {
    await burnOTPHash(input.code);
    return invalid;
  }

  return { success: true, userId: record.userId ?? undefined, otpId: record.id };
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const maskedLocal = local.length > 1 ? `${local[0]}${"*".repeat(Math.min(local.length - 1, 3))}` : "*";
  return `${maskedLocal}@${domain}`;
}

function maskTarget(target: string): string {
  if (target.includes("@")) return maskEmail(target);
  return maskMobile(target);
}

function generateCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

async function deliverEmailCode(
  email: string,
  purpose: OTPPurpose,
  code: string,
  recordId: string,
  repo: ReturnType<typeof otpRepository>,
): Promise<void> {
  const provider = resolveEmailProvider();
  const purposeLabel = purposeLabelMap[purpose] ?? "verification";
  try {
    const result = await provider.send({
      to: email,
      subject: `Your StylAIze ${purposeLabel} Code`,
      text: `Your ${purposeLabel} code is: ${code}\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
      html: otpEmailHtml(code, purposeLabel),
    });
    if (!result.success) {
      await repo.invalidate(recordId);
      throw new ServiceUnavailableError(
        "Could not deliver the verification email.",
        "EMAIL_DELIVERY_UNAVAILABLE",
      );
    }
    logInfo(
      `[OTP] Email ${provider.demoMode ? "demo-only (not delivered)" : "sent"} to ${maskEmail(email)}`,
    );
  } catch (error) {
    await repo.invalidate(recordId);
    if (error instanceof ServiceUnavailableError) throw error;
    logWarn("[OTP] Failed to send email", {
      reason: error instanceof Error ? error.name : "UNKNOWN_ERROR",
    });
    throw new ServiceUnavailableError(
      "Could not deliver the verification email.",
      "EMAIL_DELIVERY_UNAVAILABLE",
    );
  }
}

async function deliverSmsCode(
  mobile: string,
  purpose: OTPPurpose,
  code: string,
  recordId: string,
  repo: ReturnType<typeof otpRepository>,
): Promise<void> {
  const provider = resolveSmsProvider();
  const purposeLabel = purposeLabelMap[purpose] ?? "verification";
  try {
    const result = await provider.send({
      to: mobile,
      body: `StylAIze ${purposeLabel} code: ${code}. Valid for 5 minutes. Do not share this code.`,
    });
    if (!result.success) {
      await repo.invalidate(recordId);
      throw new ServiceUnavailableError(
        "Could not deliver the verification SMS.",
        "SMS_DELIVERY_UNAVAILABLE",
      );
    }
    logInfo(`[OTP] SMS sent to ${maskMobile(mobile)}`);
  } catch (error) {
    await repo.invalidate(recordId);
    if (error instanceof ServiceUnavailableError) throw error;
    logWarn("[OTP] Failed to send SMS", {
      reason: error instanceof Error ? error.name : "UNKNOWN_ERROR",
    });
    throw new ServiceUnavailableError(
      "Could not deliver the verification SMS.",
      "SMS_DELIVERY_UNAVAILABLE",
    );
  }
}

const purposeLabelMap: Record<OTPPurpose, string> = {
  login: "sign-in",
  email_verification: "email verification",
  mobile_verification: "mobile verification",
  password_reset: "password reset",
  forgot_email: "account recovery",
};

function otpEmailHtml(code: string, purpose: string): string {
  const expiryMinutes = OTP_EXPIRY_MS / 60_000;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#05070e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#05070e;padding:40px 20px;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:16px;padding:40px;">
      <tr><td align="center" style="padding-bottom:24px;">
        <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#d946ef);display:inline-block;text-align:center;line-height:48px;color:white;font-size:20px;font-weight:bold;">S</div>
      </td></tr>
      <tr><td align="center" style="padding-bottom:16px;">
        <h2 style="color:#e8edf7;margin:0;font-size:20px;">StylAIze</h2>
        <p style="color:#8d96ab;margin:4px 0 0;font-size:13px;">${purpose.charAt(0).toUpperCase() + purpose.slice(1)}</p>
      </td></tr>
      <tr><td align="center" style="padding:24px 0;">
        <div style="background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);border-radius:12px;padding:20px 32px;display:inline-block;">
          <span style="font-size:32px;font-weight:bold;color:#e8edf7;letter-spacing:8px;">${code}</span>
        </div>
      </td></tr>
      <tr><td style="padding-bottom:24px;">
        <p style="color:#8d96ab;font-size:13px;line-height:1.6;margin:0;text-align:center;">
          Your ${purpose} code is valid for <strong style="color:#e8edf7;">${expiryMinutes} minutes</strong>.<br>
          Do not share this code with anyone.
        </p>
      </td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.09);padding-top:20px;">
        <p style="color:#8d96ab;font-size:11px;margin:0;text-align:center;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
