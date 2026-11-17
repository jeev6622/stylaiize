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
  sendOtpController,
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
  sendOtpSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  forgotEmailSchema,
} from "../validators/auth.schema";

const router = Router();

router.use(authRateLimiter);

router.get("/config", authConfigController);

router.post("/register", validate(registerV2Schema), registerController);
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

// Account recovery
router.post("/forgot-password", recoveryRateLimiter, validate(forgotPasswordSchema), forgotPasswordController);
router.post("/reset-password", recoveryRateLimiter, validate(resetPasswordSchema), resetPasswordController);
router.post("/forgot-email", recoveryRateLimiter, validate(forgotEmailSchema), forgotEmailController);

export default router;
