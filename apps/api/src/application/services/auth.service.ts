import { randomBytes, randomUUID } from "node:crypto";
import type { User } from "@stylaiize/shared";
import { env } from "@/config/env";
import { isGoogleAuthConfigured } from "@/config/features";
import { emailProviderStatus } from "@/infrastructure/email/factory";
import { userRepository } from "@/infrastructure/repos/user.repo";
import { refreshTokenRepository } from "@/infrastructure/repos/refresh-token.repo";
import {
  BadRequestError,
  ConflictError,
  ServiceUnavailableError,
  UnauthorizedError,
} from "@/utils/errors";
import type { TokenPayload } from "@/utils/jwt";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/utils/jwt";
import {
  burnOTPHash,
  burnPasswordCompare,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "@/utils/password";
import { generateOTP, verifyOTP, maskEmail } from "./otp.service";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: User;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface MobileLoginInput {
  countryCode: string;
  mobile: string;
  password: string;
  rememberMe?: boolean;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await userRepository().findByEmail(input.email);
  if (existing) {
    throw new ConflictError(
      "An account with this email already exists.",
      "EMAIL_TAKEN",
    );
  }

  const passwordHash = await hashPassword(input.password);
  const user = await userRepository().create({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash,
  });

  return { user, ...(await issueTokens(user)) };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await userRepository().findByEmail(input.email);
  // Same message for unknown email / wrong password to avoid account enumeration.
  const invalid = new UnauthorizedError(
    "Invalid email or password.",
    "INVALID_CREDENTIALS",
  );
  if (!user || !user.passwordHash) {
    // Keep the cost of an unknown account identical to a wrong password so the
    // response time cannot be used to discover which emails are registered.
    await burnPasswordCompare(input.password);
    throw invalid;
  }

  const matches = await verifyPassword(input.password, user.passwordHash);
  if (!matches) {
    throw invalid;
  }

  return { user, ...(await issueTokens(user, undefined, input.rememberMe ?? false)) };
}

export async function requestLoginOtp(email: string): Promise<{ success: true }> {
  const normalized = email.trim().toLowerCase();
  if (!emailProviderStatus().active) {
    throw new ServiceUnavailableError(
      "Email delivery is currently unavailable.",
      "EMAIL_DELIVERY_UNAVAILABLE",
    );
  }

  const user = await userRepository().findByEmail(normalized);
  if (!user) {
    await burnOTPHash("000000");
    return { success: true };
  }

  await generateOTP({
    purpose: "login",
    userId: user.id,
    email: normalized,
    requireRealDelivery: true,
  });
  return { success: true };
}

export async function loginWithOtp(
  email: string,
  code: string,
  rememberMe = false,
): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const invalid = new UnauthorizedError(
    "Invalid or expired sign-in code.",
    "INVALID_OTP",
  );
  const result = await verifyOTP({ target: normalized, code, purpose: "login" });
  if (!result.success || !result.userId) {
    throw invalid;
  }

  const user = await userRepository().findById(result.userId);
  if (!user || user.email.toLowerCase() !== normalized) {
    throw invalid;
  }

  if (!user.emailVerified || !user.providers.includes("email")) {
    const updated = await userRepository().update(user.id, {
      emailVerified: true,
      providers: [...new Set([...user.providers, "email" as const])],
    });
    if (updated) {
      return { user: updated, ...(await issueTokens(updated, undefined, rememberMe)) };
    }
  }

  return { user, ...(await issueTokens(user, undefined, rememberMe)) };
}

export async function loginWithMobile(input: MobileLoginInput): Promise<AuthResult> {
  const user = await userRepository().findByMobile(input.countryCode, input.mobile);
  const invalid = new UnauthorizedError(
    "Invalid mobile number or password.",
    "INVALID_CREDENTIALS",
  );
  if (!user || !user.passwordHash) {
    await burnPasswordCompare(input.password);
    throw invalid;
  }
  const matches = await verifyPassword(input.password, user.passwordHash);
  if (!matches) {
    throw invalid;
  }
  return { user, ...(await issueTokens(user, undefined, input.rememberMe ?? false)) };
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError(
      "Refresh token invalid or expired.",
      "INVALID_REFRESH_TOKEN",
    );
  }

  const user = await userRepository().findById(payload.sub);
  if (!user) {
    throw new UnauthorizedError("Account not found.", "ACCOUNT_NOT_FOUND");
  }

  const rtRepo = refreshTokenRepository();
  const { createHash } = await import("node:crypto");
  const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
  const existingRecord = await rtRepo.findByTokenHash(tokenHash);

  if (existingRecord) {
    if (existingRecord.revokedAt) {
      await rtRepo.revokeFamily(existingRecord.familyId);
      throw new UnauthorizedError(
        "Refresh token reuse detected. All sessions revoked.",
        "TOKEN_REUSE_DETECTED",
      );
    }
    await rtRepo.revokeFamily(existingRecord.familyId);
  }

  const familyId = existingRecord?.familyId ?? randomUUID();
  return { user, ...(await issueTokens(user, familyId, payload.rm ?? true)) };
}

/**
 * Ends the caller's session by revoking the presented refresh token.
 *
 * The access token is stateless and cannot be revoked server-side, so it is
 * left to expire; the refresh token *is* persisted, so it must be revoked or a
 * stolen copy would keep minting new access tokens until it expires.
 *
 * Revoking the whole token family also covers the case where the client
 * presents a token that was already rotated out, which is exactly the copy an
 * attacker would hold after a theft.
 */
export async function logout(refreshToken?: string, userId?: string): Promise<void> {
  if (refreshToken) {
    const { createHash } = await import("node:crypto");
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    const record = await refreshTokenRepository().findByTokenHash(tokenHash);
    if (record) {
      await refreshTokenRepository().revokeFamily(record.familyId);
      return;
    }
  }

  // No usable refresh token: fall back to killing every session for the caller.
  if (userId) {
    await invalidateAllSessions(userId);
  }
}

export async function forgotPassword(identifier: string): Promise<{ success: boolean }> {
  if (identifier.includes("@")) {
    const user = await userRepository().findByEmail(identifier);
    if (user) {
      await generateOTP({
        purpose: "password_reset",
        userId: user.id,
        email: user.email,
      });
    }
  } else {
    const match = identifier.match(/^(\+\d{1,4})(\d{6,15})$/);
    if (match) {
      const user = await userRepository().findByMobile(match[1], match[2]);
      if (user) {
        await generateOTP({
          purpose: "password_reset",
          userId: user.id,
          mobile: user.mobile ?? undefined,
          countryCode: user.countryCode ?? undefined,
        });
      }
    }
  }
  return { success: true };
}

export async function resetPassword(
  target: string,
  code: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    throw new BadRequestError(strength.errors.join(" "), "WEAK_PASSWORD");
  }

  const result = await verifyOTP({ target, code, purpose: "password_reset" });
  if (!result.success || !result.userId) {
    throw new BadRequestError("Invalid or expired reset token.", "INVALID_RESET_TOKEN");
  }

  const passwordHash = await hashPassword(newPassword);
  await userRepository().update(result.userId, { passwordHash });
  await invalidateAllSessions(result.userId);
  return { success: true };
}

export async function forgotEmail(
  countryCode: string,
  mobile: string,
): Promise<{ success: boolean; maskedEmail?: string }> {
  const user = await userRepository().findByMobile(countryCode, mobile);
  if (user) {
    return { success: true, maskedEmail: maskEmail(user.email) };
  }
  return { success: true };
}

export async function invalidateAllSessions(userId: string): Promise<void> {
  await refreshTokenRepository().revokeAllForUser(userId);
}

export async function issueTokens(
  user: User,
  familyId?: string,
  rememberMe = true,
): Promise<AuthTokens> {
  const refreshTtlMs = rememberMe
    ? 30 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;
  const refreshExpiresIn = rememberMe ? "30d" : "1d";

  const payload = { sub: user.id, role: user.role, rm: rememberMe };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload, refreshExpiresIn);

  const { createHash } = await import("node:crypto");
  const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
  const rtFamilyId = familyId ?? randomUUID();

  await refreshTokenRepository().create({
    id: randomUUID(),
    userId: user.id,
    tokenHash,
    familyId: rtFamilyId,
    expiresAt: new Date(Date.now() + refreshTtlMs).toISOString(),
    revokedAt: null,
    createdAt: new Date().toISOString(),
  });

  return { accessToken, refreshToken };
}

// ---------------------------------------------------------------------------
// Google OAuth (authorization-code flow, no external OAuth library needed)
// ---------------------------------------------------------------------------

interface PendingOAuthState {
  expiresAt: number;
}
const pendingStates = new Map<string, PendingOAuthState>();
const STATE_TTL_MS = 10 * 60 * 1000;

function pruneStates(): void {
  const now = Date.now();
  for (const [key, value] of pendingStates) {
    if (value.expiresAt < now) pendingStates.delete(key);
  }
}

export interface GoogleProfile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export function createGoogleAuthUrl(): { url: string; state: string } | null {
  if (!isGoogleAuthConfigured) return null;

  pruneStates();
  const state = randomBytes(24).toString("hex");
  pendingStates.set(state, { expiresAt: Date.now() + STATE_TTL_MS });

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, state };
}

export function consumeGoogleState(state: string): boolean {
  pruneStates();
  const entry = pendingStates.get(state);
  if (!entry) return false;
  pendingStates.delete(state);
  return true;
}

/** Exchanges an authorization code for a Google ID-token profile. */
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new BadRequestError(
      "Google rejected the authorization code.",
      "GOOGLE_TOKEN_EXCHANGE_FAILED",
    );
  }
  const tokens = (await res.json()) as { id_token?: string; access_token?: string };
  if (!tokens.id_token) {
    throw new BadRequestError(
      "Google did not return an identity token.",
      "GOOGLE_ID_TOKEN_MISSING",
    );
  }

  const profileRes = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${tokens.access_token ?? ""}` } },
  );
  if (!profileRes.ok) {
    throw new ServiceUnavailableError(
      "Could not load your Google profile.",
      "GOOGLE_PROFILE_FETCH_FAILED",
    );
  }
  return (await profileRes.json()) as GoogleProfile;
}

/** Finds or creates the local account for a Google profile and issues tokens. */
export async function loginWithGoogleProfile(
  profile: GoogleProfile,
): Promise<AuthResult> {
  const email = profile.email?.toLowerCase();
  if (!email) {
    throw new BadRequestError(
      "Your Google account has no email address.",
      "GOOGLE_EMAIL_MISSING",
    );
  }

  const repo = userRepository();
  let user =
    (await repo.findByGoogleId(profile.sub)) ??
    (await repo.findByEmail(email));

  if (!user) {
    user = await repo.create({
      name: profile.name ?? email.split("@")[0],
      email,
      googleId: profile.sub,
      avatarUrl: profile.picture ?? null,
      emailVerified: profile.email_verified ?? false,
    });
  } else if (!user.googleId) {
    // Link Google to the existing email account.
    const updated = await repo.update(user.id, {
      googleId: profile.sub,
      avatarUrl: user.avatarUrl ?? profile.picture ?? null,
      emailVerified: user.emailVerified || (profile.email_verified ?? false),
      providers: [...new Set([...user.providers, "google" as const])],
    });
    if (updated) user = updated;
  }

  return { user, ...(await issueTokens(user)) };
}
