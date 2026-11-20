import type { Request, Response } from "express";
import { isGoogleAuthConfigured } from "@/config/features";
import { env } from "@/config/env";
import { aiProviderStatus } from "@/infrastructure/ai/factory";
import { emailProviderStatus } from "@/infrastructure/email/factory";
import { smsProviderStatus } from "@/infrastructure/sms/factory";
import { asyncHandler, ok, created } from "@/utils/async-handler";
import { UnauthorizedError } from "@/utils/errors";
import { toPublicUser } from "@/utils/user";
import * as authService from "@/application/services/auth.service";
import * as otpService from "@/application/services/otp.service";
import * as registrationService from "@/application/services/registration.service";
import type {
  LoginInput,
  RefreshInput,
  RegistrationIdInput,
  RegistrationResendInput,
  RegistrationVerifyInput,
  RegisterV2Input,
  SendOtpInput,
  SendLoginOtpInput,
  VerifyLoginOtpInput,
  VerifyOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ForgotEmailInput,
} from "@/api/validators/auth.schema";

/**
 * Phase 2 auth endpoints: register / login / refresh / logout / me
 * plus the Google OAuth authorization-code flow.
 */

export const authConfigController = asyncHandler(async (_req: Request, res: Response) => {
  const ai = aiProviderStatus();
  ok(res, {
    emailLogin: true,
    mobileLogin: true,
    emailOtpAvailable: emailProviderStatus().active,
    mobileOtpAvailable: smsProviderStatus().active,
    registrationAvailable: emailProviderStatus().active && smsProviderStatus().active,
    passwordLoginAvailable: true,
    googleLogin: isGoogleAuthConfigured,
    demoMode: !isGoogleAuthConfigured,
    /** Honest AI capability state so the UI never implies a working AI. */
    ai: { active: ai.active, configured: ai.configured, demoMode: ai.demoMode },
    aiProviderMaxImageBytes: Math.floor(env.AI_MAX_IMAGE_CHARS * 0.75),
  });
});

export const startRegistrationController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as RegisterV2Input;
  created(res, await registrationService.startRegistration(input));
});

export const resendRegistrationOtpController = asyncHandler(async (req: Request, res: Response) => {
  const { registrationId, channel } = req.body as RegistrationResendInput;
  ok(res, await registrationService.resendRegistrationOtp(registrationId, channel));
});

export const verifyRegistrationOtpController = asyncHandler(async (req: Request, res: Response) => {
  const { registrationId, channel, code } = req.body as RegistrationVerifyInput;
  ok(res, await registrationService.verifyRegistrationOtp(registrationId, channel, code));
});

export const registerController = asyncHandler(async (req: Request, res: Response) => {
  const { registrationId } = req.body as RegistrationIdInput;
  const result = await registrationService.completeRegistration(registrationId);
  result.user = toPublicUser(result.user);
  created(res, result);
});

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as LoginInput;
  let result;
  if ("email" in input && input.email) {
    result = await authService.login(input);
  } else if ("countryCode" in input && "mobile" in input) {
    result = await authService.loginWithMobile(input);
  } else {
    throw new UnauthorizedError("Invalid login input.", "INVALID_LOGIN_INPUT");
  }
  result.user = toPublicUser(result.user);
  ok(res, result);
});

export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Partial<RefreshInput>;
  const cookieToken = req.cookies?.refreshToken;
  const refreshToken = body.refreshToken ?? cookieToken;
  if (!refreshToken) {
    throw new UnauthorizedError("Refresh token is required.", "MISSING_REFRESH_TOKEN");
  }
  const result = await authService.refresh(refreshToken);
  result.user = toPublicUser(result.user);
  ok(res, result);
});

export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Partial<RefreshInput>;
  const refreshToken = body.refreshToken ?? req.cookies?.refreshToken;
  // `optionalAuth` populates `req.user` when the access token is still valid,
  // which lets us revoke every session for the account as a fallback.
  await authService.logout(refreshToken, req.user?.id);
  res.clearCookie("refreshToken", { path: "/" });
  ok(res, { loggedOut: true });
});

export const meController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  ok(res, { user: toPublicUser(req.user) });
});

// ---------------------------------------------------------------------------
// OTP endpoints
// ---------------------------------------------------------------------------

export const sendOtpController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as SendOtpInput;
  await otpService.generateOTP(input);
  ok(res, {
    success: true,
    message: "If the account exists, a verification code has been sent.",
  });
});

export const requestLoginOtpController = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as SendLoginOtpInput;
  await authService.requestLoginOtp(email);
  ok(res, {
    success: true,
    message: "If an account exists for that email, a sign-in code has been sent.",
  });
});

export const verifyLoginOtpController = asyncHandler(async (req: Request, res: Response) => {
  const { email, code, rememberMe } = req.body as VerifyLoginOtpInput;
  const result = await authService.loginWithOtp(email, code, rememberMe);
  result.user = toPublicUser(result.user);
  ok(res, result);
});

export const verifyOtpController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as VerifyOtpInput;
  // Don't mark OTP as used here — the reset-password step will consume it
  const result = await otpService.verifyOTP({ ...input, markUsed: false });
  ok(res, result);
});

// ---------------------------------------------------------------------------
// Account recovery
// ---------------------------------------------------------------------------

export const forgotPasswordController = asyncHandler(async (req: Request, res: Response) => {
  const { identifier } = req.body as ForgotPasswordInput;
  const result = await authService.forgotPassword(identifier);
  ok(res, result);
});

export const resetPasswordController = asyncHandler(async (req: Request, res: Response) => {
  const { target, code, password } = req.body as ResetPasswordInput;
  const result = await authService.resetPassword(target, code, password);
  ok(res, result);
});

export const forgotEmailController = asyncHandler(async (req: Request, res: Response) => {
  const { countryCode, mobile } = req.body as ForgotEmailInput;
  const result = await authService.forgotEmail(countryCode, mobile);
  ok(res, result);
});

// ---------------------------------------------------------------------------
// Google OAuth
// ---------------------------------------------------------------------------

export const googleStartController = asyncHandler(async (_req: Request, res: Response) => {
  const authUrl = authService.createGoogleAuthUrl();
  if (!authUrl) {
    res.redirect(`${env.WEB_PUBLIC_URL}/login?error=google_not_configured`);
    return;
  }
  res.redirect(authUrl.url);
});

export const googleCallbackController = asyncHandler(async (req: Request, res: Response) => {
  const webUrl = env.WEB_PUBLIC_URL;
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;

  try {
    if (!code || !state || !authService.consumeGoogleState(state)) {
      throw new UnauthorizedError("Invalid OAuth state.", "INVALID_OAUTH_STATE");
    }
    const profile = await authService.exchangeGoogleCode(code);
    const result = await authService.loginWithGoogleProfile(profile);
    const params = new URLSearchParams({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    res.redirect(`${webUrl}/auth/callback?${params}`);
  } catch (err) {
    const message =
      err instanceof Error && err.message ? encodeURIComponent(err.message) : "oauth_failed";
    res.redirect(`${webUrl}/auth/callback?error=${message}`);
  }
});
