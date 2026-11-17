import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const ROUNDS = 12;
/** OTP codes are 6 digits, so a weak cost is crackable far too easily. */
const OTP_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push("Password must be at least 8 characters long.");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain at least 1 uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("Password must contain at least 1 lowercase letter.");
  if (!/[0-9]/.test(password)) errors.push("Password must contain at least 1 number.");
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    errors.push("Password must contain at least 1 special character.");
  }
  return { valid: errors.length === 0, errors };
}

export async function hashOTP(code: string): Promise<string> {
  return bcrypt.hash(code, OTP_ROUNDS);
}

export async function verifyOTPCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

let decoyHash: Promise<string> | null = null;

/**
 * Burns a real bcrypt comparison against a throw-away hash.
 *
 * Without this, a login for an unknown account skips hashing entirely and
 * returns in a few ms while a wrong password costs a full bcrypt round, which
 * is enough to enumerate registered emails by timing even though the error
 * message is identical for both cases.
 */
export async function burnPasswordCompare(plain: string): Promise<void> {
  decoyHash ??= hashPassword(randomBytes(24).toString("hex"));
  await verifyPassword(plain, await decoyHash);
}
