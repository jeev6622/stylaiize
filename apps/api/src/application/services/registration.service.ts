import type { PendingRegistration } from "@stylaiize/shared";
import { isValidEmail, isValidIndianMobile, isValidPassword } from "@stylaiize/shared";
import { emailProviderStatus } from "@/infrastructure/email/factory";
import { smsProviderStatus } from "@/infrastructure/sms/factory";
import { userRepository } from "@/infrastructure/repos/user.repo";
import { pendingRegistrationRepository } from "@/infrastructure/repos/pending-registration.repo";
import { otpRepository } from "@/infrastructure/repos/otp.repo";
import { generateOTP, verifyOTP } from "@/application/services/otp.service";
import { issueTokens, type AuthResult } from "@/application/services/auth.service";
import { hashPassword, validatePasswordStrength } from "@/utils/password";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ServiceUnavailableError } from "@/utils/errors";

export interface StartRegistrationInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  mobile: string;
  countryCode: string;
}

export type VerificationChannel = "email" | "mobile";

const REGISTRATION_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function assertInput(input: StartRegistrationInput): void {
  if (!isValidEmail(input.email)) {
    throw new BadRequestError("Enter a valid email address.", "INVALID_EMAIL");
  }
  if (input.countryCode !== "+91" || !isValidIndianMobile(input.mobile)) {
    throw new BadRequestError("Enter a valid Indian mobile number with the +91 country code.", "INVALID_MOBILE");
  }
  if (!isValidPassword(input.password)) {
    const strength = validatePasswordStrength(input.password);
    throw new BadRequestError(strength.errors.join(" "), "WEAK_PASSWORD");
  }
  if (input.password !== input.confirmPassword) {
    throw new BadRequestError("Passwords do not match.", "PASSWORD_MISMATCH");
  }
}

function activeOrThrow(record: PendingRegistration | null): PendingRegistration {
  if (!record || new Date(record.expiresAt).getTime() <= Date.now()) {
    throw new NotFoundError("Registration session expired. Start again.", "REGISTRATION_EXPIRED");
  }
  return record;
}

function channelTarget(record: PendingRegistration, channel: VerificationChannel): string {
  return channel === "email" ? record.email : `${record.countryCode}${record.mobile}`;
}

function channelPurpose(channel: VerificationChannel): "email_verification" | "mobile_verification" {
  return channel === "email" ? "email_verification" : "mobile_verification";
}

function assertProvidersAvailable(): void {
  if (!emailProviderStatus().active) {
    throw new ServiceUnavailableError(
      "Email delivery is currently unavailable.",
      "EMAIL_DELIVERY_UNAVAILABLE",
    );
  }
  if (!smsProviderStatus().active) {
    throw new ServiceUnavailableError(
      "SMS delivery is currently unavailable.",
      "SMS_DELIVERY_UNAVAILABLE",
    );
  }
}

async function ensureUnique(
  email: string,
  mobile: string,
  countryCode: string,
  excludeRegistrationId?: string,
): Promise<void> {
  const userRepo = userRepository();
  const pendingRepo = pendingRegistrationRepository();
  const [userByEmail, userByMobile, pendingByEmail, pendingByMobile] = await Promise.all([
    userRepo.findByEmail(email),
    userRepo.findByMobile(countryCode, mobile),
    pendingRepo.findByEmail(email),
    pendingRepo.findByMobile(mobile),
  ]);

  if (userByEmail || (pendingByEmail && pendingByEmail.id !== excludeRegistrationId)) {
    throw new ConflictError("An account with this email already exists.", "EMAIL_TAKEN");
  }
  if (userByMobile || (pendingByMobile && pendingByMobile.id !== excludeRegistrationId)) {
    throw new ConflictError("An account with this mobile number already exists.", "MOBILE_TAKEN");
  }
}

export async function startRegistration(input: StartRegistrationInput): Promise<{
  registrationId: string;
  email: string;
  mobile: string;
  expiresAt: string;
  resendAvailableAt: string;
}> {
  assertInput(input);
  assertProvidersAvailable();

  const email = normalizeEmail(input.email);
  const mobile = input.mobile;
  const pendingRepo = pendingRegistrationRepository();
  await pendingRepo.deleteExpired();
  await ensureUnique(email, mobile, input.countryCode);

  const expiresAt = new Date(Date.now() + REGISTRATION_TTL_MS).toISOString();
  const passwordHash = await hashPassword(input.password);
  const pending = await pendingRepo.create({
    name: input.name,
    email,
    mobile,
    countryCode: input.countryCode,
    passwordHash,
    emailVerified: false,
    mobileVerified: false,
    emailOtpId: null,
    mobileOtpId: null,
    expiresAt,
  });

  try {
    const emailOtp = await generateOTP({
      purpose: "email_verification",
      userId: pending.id,
      email,
      requireRealDelivery: true,
    });
    await pendingRepo.update(pending.id, { emailOtpId: emailOtp.otpId });

    const mobileOtp = await generateOTP({
      purpose: "mobile_verification",
      userId: pending.id,
      mobile,
      countryCode: input.countryCode,
    });
    await pendingRepo.update(pending.id, { mobileOtpId: mobileOtp.otpId });
  } catch (error) {
    await otpRepository().invalidateActiveForTarget(email, "email_verification");
    await otpRepository().invalidateActiveForTarget(`${input.countryCode}${mobile}`, "mobile_verification");
    await pendingRepo.delete(pending.id);
    throw error;
  }

  return {
    registrationId: pending.id,
    email,
    mobile,
    expiresAt,
    resendAvailableAt: new Date(Date.now() + RESEND_COOLDOWN_MS).toISOString(),
  };
}

export async function resendRegistrationOtp(
  registrationId: string,
  channel: VerificationChannel,
): Promise<{ channel: VerificationChannel; resendAvailableAt: string }> {
  const pending = activeOrThrow(await pendingRegistrationRepository().findById(registrationId));
  if (channel === "email" && pending.emailVerified) {
    throw new BadRequestError("Email is already verified.", "ALREADY_VERIFIED");
  }
  if (channel === "mobile" && pending.mobileVerified) {
    throw new BadRequestError("Mobile number is already verified.", "ALREADY_VERIFIED");
  }

  const otp = await generateOTP({
    purpose: channelPurpose(channel),
    userId: pending.id,
    ...(channel === "email"
      ? { email: pending.email, requireRealDelivery: true }
      : { mobile: pending.mobile, countryCode: pending.countryCode }),
  });

  await pendingRegistrationRepository().update(pending.id, {
    ...(channel === "email" ? { emailOtpId: otp.otpId } : { mobileOtpId: otp.otpId }),
  });

  return {
    channel,
    resendAvailableAt: new Date(Date.now() + RESEND_COOLDOWN_MS).toISOString(),
  };
}

export async function verifyRegistrationOtp(
  registrationId: string,
  channel: VerificationChannel,
  code: string,
): Promise<{ channel: VerificationChannel; verified: boolean; bothVerified: boolean }> {
  const pending = activeOrThrow(await pendingRegistrationRepository().findById(registrationId));
  if (channel === "email" && pending.emailVerified) {
    throw new BadRequestError("Email is already verified.", "ALREADY_VERIFIED");
  }
  if (channel === "mobile" && pending.mobileVerified) {
    throw new BadRequestError("Mobile number is already verified.", "ALREADY_VERIFIED");
  }

  const purpose = channelPurpose(channel);
  const expectedOtpId = channel === "email" ? pending.emailOtpId : pending.mobileOtpId;
  const result = await verifyOTP({
    target: channelTarget(pending, channel),
    code,
    purpose,
    expectedUserId: pending.id,
  });

  if (!result.success || !result.otpId || result.otpId !== expectedOtpId) {
    const errorCode =
      result.reason === "expired"
        ? "OTP_EXPIRED"
        : result.reason === "attempts_exceeded"
          ? "OTP_ATTEMPTS_EXCEEDED"
          : "INVALID_OTP";
    throw new BadRequestError("Invalid or expired verification code.", errorCode);
  }

  const updated = await pendingRegistrationRepository().update(pending.id, {
    ...(channel === "email" ? { emailVerified: true } : { mobileVerified: true }),
  });
  if (!updated) {
    throw new NotFoundError("Registration session not found.", "REGISTRATION_NOT_FOUND");
  }

  return {
    channel,
    verified: true,
    bothVerified: updated.emailVerified && updated.mobileVerified,
  };
}

export async function completeRegistration(registrationId: string): Promise<AuthResult> {
  if (!registrationId) {
    throw new BadRequestError("Registration session is required.", "REGISTRATION_ID_REQUIRED");
  }
  if (!/^[0-9a-f-]{36}$/i.test(registrationId) && !/^[a-f0-9]{24}$/i.test(registrationId)) {
    throw new BadRequestError("Invalid registration session.", "INVALID_REGISTRATION_ID");
  }

  const pending = activeOrThrow(
    await pendingRegistrationRepository().findById(registrationId.trim()),
  );
  if (!pending.emailVerified || !pending.mobileVerified) {
    throw new ForbiddenError(
      "Verify your email and mobile number before creating an account.",
      "REGISTRATION_NOT_VERIFIED",
    );
  }

  await ensureUnique(pending.email, pending.mobile, pending.countryCode, pending.id);

  let user;
  try {
    user = await userRepository().create({
      name: pending.name,
      email: pending.email,
      passwordHash: pending.passwordHash,
      mobile: pending.mobile,
      countryCode: pending.countryCode,
      emailVerified: true,
      mobileVerified: true,
    });
  } catch (error) {
    const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === 11000;
    if (duplicate) {
      throw new ConflictError("Account details are already registered.", "REGISTRATION_CONFLICT");
    }
    throw error;
  }

  await pendingRegistrationRepository().delete(pending.id);
  return { user, ...(await issueTokens(user)) };
}
