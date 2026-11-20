import { Router } from "express";
import { authRateLimiter, otpRateLimiter, recoveryRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware";
import {
  authConfigController,
  googleCallbackController,
  googleStartController,
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
  resendRegistrationOtpController,
  startRegistrationController,
  verifyRegistrationOtpController,
  requestLoginOtpController,
  sendOtpController,
  verifyLoginOtpController,
  verifyOtpController,
  forgotPasswordController,
  resetPasswordController,
  forgotEmailController,
} from "../controllers/auth.controller";
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  registerV2Schema,
  registrationIdSchema,
  registrationResendSchema,
  registrationVerifySchema,
  sendLoginOtpSchema,
  sendOtpSchema,
  verifyLoginOtpSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  forgotEmailSchema,
} from "../validators/auth.schema";

const router = Router();

router.use(authRateLimiter);

router.get("/config", authConfigController);

router.post("/register/start", otpRateLimiter, validate(registerV2Schema), startRegistrationController);
router.post("/register/resend", otpRateLimiter, validate(registrationResendSchema), resendRegistrationOtpController);
router.post("/register/verify", otpRateLimiter, validate(registrationVerifySchema), verifyRegistrationOtpController);
router.post("/register", validate(registrationIdSchema), registerController);
router.post("/login", validate(loginSchema), loginController);
router.post("/refresh", validate(refreshSchema), refreshController);
router.post("/logout", optionalAuth, validate(logoutSchema), logoutController);
router.get("/me", requireAuth, meController);

// Google OAuth (authorization-code flow)
router.get("/google", googleStartController);
router.get("/google/callback", googleCallbackController);

// OTP
router.post("/otp/send", otpRateLimiter, validate(sendOtpSchema), sendOtpController);
router.post("/otp/verify", otpRateLimiter, validate(verifyOtpSchema), verifyOtpController);
router.post(
  "/otp/login/request",
  otpRateLimiter,
  validate(sendLoginOtpSchema),
  requestLoginOtpController,
);
router.post(
  "/otp/login/verify",
  otpRateLimiter,
  validate(verifyLoginOtpSchema),
  verifyLoginOtpController,
);

// Account recovery
router.post("/forgot-password", recoveryRateLimiter, validate(forgotPasswordSchema), forgotPasswordController);
router.post("/reset-password", recoveryRateLimiter, validate(resetPasswordSchema), resetPasswordController);
router.post("/forgot-email", recoveryRateLimiter, validate(forgotEmailSchema), forgotEmailController);

export default router;
