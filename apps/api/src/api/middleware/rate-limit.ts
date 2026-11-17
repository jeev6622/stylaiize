import rateLimit from "express-rate-limit";
import { env } from "@/config/env";

const isDev = env.NODE_ENV !== "production";

/** Generic handler for all rate limiters */
function rateLimitHandler(message: string) {
  return (_req: unknown, res: { status: (code: number) => { json: (data: unknown) => void } }) => {
    res.status(429).json({
      success: false,
      error: { code: "RATE_LIMITED", message },
    });
  };
}

/** No-op limiter for development */
function noopLimiter() {
  return (_req: unknown, _res: unknown, next: () => void) => next();
}

/** Skip health checks from rate limiting */
function skipHealthCheck(req: { path?: string }): boolean {
  return req.path === "/health" || req.path === "/healthz";
}

/** General API rate limiter — applied globally via app.ts */
export const apiRateLimiter = isDev ? noopLimiter() : rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipHealthCheck,
  handler: rateLimitHandler("Too many requests. Please try again later."),
});

/** Stricter limiter for auth endpoints to slow down credential stuffing. */
export const authRateLimiter = isDev ? noopLimiter() : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler("Too many auth attempts. Please try again later."),
});

/** OTP rate limiter to prevent abuse of OTP sending. */
export const otpRateLimiter = isDev ? noopLimiter() : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler("Too many OTP requests. Please try again later."),
});

/** Recovery rate limiter for password reset and account recovery endpoints. */
export const recoveryRateLimiter = isDev ? noopLimiter() : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler("Too many recovery requests. Please try again later."),
});

/** Chat / AI endpoint limiter — AI calls are expensive. */
export const chatRateLimiter = isDev ? noopLimiter() : rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler("Too many chat requests. Please slow down."),
});

/** File upload limiter — uploads are heavy. */
export const uploadRateLimiter = isDev ? noopLimiter() : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler("Too many uploads. Please try again later."),
});

/** Admin endpoints limiter — moderate limits. */
export const adminRateLimiter = isDev ? noopLimiter() : rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler("Too many admin requests. Please try again later."),
});

/** Outfit recommendation limiter — heavy AI processing. */
export const recommendRateLimiter = isDev ? noopLimiter() : rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler("Too many recommendation requests. Please wait."),
});
