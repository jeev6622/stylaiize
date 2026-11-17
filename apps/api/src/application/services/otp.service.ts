import { randomUUID } from "node:crypto";
import type { OTPPurpose, OTPRecord } from "@stylaiize/shared";
import { otpRepository } from "@/infrastructure/repos/otp.repo";
import { resolveEmailProvider } from "@/infrastructure/email/factory";
import { hashOTP, verifyOTPCode } from "@/utils/password";
import { logInfo, logError } from "@/utils/logger";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const OTP_LENGTH = 6;

export interface GenerateOTPInput {
  purpose: OTPPurpose;
  userId?: string;
  email?: string;
  mobile?: string;
  countryCode?: string;
}

export async function generateOTP(input: GenerateOTPInput): Promise<{ target: string }> {
  const code = generateCode();
  const codeHash = await hashOTP(code);

  let target = "";
  if (input.email) {
    target = input.email.toLowerCase();
  } else if (input.mobile && input.countryCode) {
    target = `${input.countryCode}${input.mobile}`;
  }

  const record: OTPRecord = {
    id: randomUUID(),
    userId: input.userId ?? null,
    email: input.email?.toLowerCase() ?? null,
    mobile: input.mobile ?? null,
    countryCode: input.countryCode ?? null,
    codeHash,
    purpose: input.purpose,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
    usedAt: null,
    createdAt: new Date().toISOString(),
  };

  await otpRepository().create(record);
  await otpRepository().deleteExpired();

  logInfo(`[OTP] ${input.purpose} OTP generated for ${maskTarget(target)}`);

  // Send OTP via email if target is an email address
  if (input.email) {
    try {
      const emailProvider = resolveEmailProvider();
      const purposeLabel = purposeLabelMap[input.purpose] ?? "verification";
      await emailProvider.send({
        to: input.email,
        subject: `Your StylAIze ${purposeLabel} Code`,
        text: `Your ${purposeLabel} code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
        html: otpEmailHtml(code, purposeLabel),
      });
      logInfo(`[OTP] Email sent to ${maskEmail(input.email)}`);
    } catch (err) {
      logError("[OTP] Failed to send email", err);
    }
  }

  return { target };
}

export interface VerifyOTPInput {
  target: string;
  code: string;
  purpose: OTPPurpose;
  /** When true, validates the OTP but does NOT mark it as used.
   *  Use this for the verify-otp step so the actual reset-password step
   *  can still find and consume the same OTP. */
  markUsed?: boolean;
}

export async function verifyOTP(input: VerifyOTPInput): Promise<{ success: boolean; userId?: string }> {
  const record = await otpRepository().findByTarget(input.target, input.purpose);
  if (!record) {
    return { success: false };
  }

  if (new Date(record.expiresAt) < new Date()) {
    return { success: false };
  }

  if (record.attempts >= record.maxAttempts) {
    return { success: false };
  }

  const matches = await verifyOTPCode(input.code, record.codeHash);
  if (!matches) {
    await otpRepository().incrementAttempts(record.id);
    return { success: false };
  }

  // Only mark as used when markUsed is explicitly true (default: true for backwards compat)
  if (input.markUsed !== false) {
    await otpRepository().markUsed(record.id);
  }
  return { success: true, userId: record.userId ?? undefined };
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const maskedLocal = local.length > 1 ? `${local[0]}${"*".repeat(Math.min(local.length - 1, 3))}` : "*";
  return `${maskedLocal}@${domain}`;
}

function maskTarget(target: string): string {
  if (target.includes("@")) return maskEmail(target);
  if (target.length > 4) return `${target.slice(0, 3)}${"*".repeat(target.length - 3)}`;
  return "***";
}

function generateCode(): string {
  let code = "";
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

const purposeLabelMap: Record<OTPPurpose, string> = {
  email_verification: "email verification",
  mobile_verification: "mobile verification",
  password_reset: "password reset",
  forgot_email: "account recovery",
};

function otpEmailHtml(code: string, purpose: string): string {
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
          Your ${purpose} code is valid for <strong style="color:#e8edf7;">10 minutes</strong>.<br>
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
