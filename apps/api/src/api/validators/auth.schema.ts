import { z } from "zod";
import { OTP_PURPOSES } from "@stylaiize/shared";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be at most 128 characters."),
});

const passwordStrengthRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;

export const registerV2Schema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z
      .string()
      .regex(
        passwordStrengthRegex,
        "Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 digit, and 1 special character.",
      ),
    confirmPassword: z.string().min(1, "Please confirm your password."),
    mobile: z.string().regex(/^\d{6,15}$/, "Mobile number must be 6-15 digits."),
    countryCode: z.string().regex(/^\+\d{1,4}$/, "Country code must start with + and contain 1-4 digits."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.union([
  z.object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z.string().min(1, "Password is required."),
    rememberMe: z.boolean().optional().default(false),
  }),
  z.object({
    countryCode: z.string().regex(/^\+\d{1,4}$/, "Country code must start with + and contain 1-4 digits."),
    mobile: z.string().regex(/^\d{6,15}$/, "Mobile number must be 6-15 digits."),
    password: z.string().min(1, "Password is required."),
    rememberMe: z.boolean().optional().default(false),
  }),
]);

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required."),
});

/**
 * Logout accepts an absent/blank refresh token: clients that have already
 * discarded their token should still be able to end the session server-side.
 */
export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const sendOtpSchema = z.object({
  purpose: z.enum(OTP_PURPOSES),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").optional(),
  mobile: z.string().regex(/^\d{6,15}$/, "Mobile number must be 6-15 digits.").optional(),
  countryCode: z.string().regex(/^\+\d{1,4}$/, "Country code must start with + and contain 1-4 digits.").optional(),
});

export const verifyOtpSchema = z.object({
  target: z.string().min(1, "Target is required."),
  code: z.string().regex(/^\d{6}$/, "OTP code must be exactly 6 digits."),
  purpose: z.enum(OTP_PURPOSES),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Identifier is required."),
});

export const resetPasswordSchema = z
  .object({
    target: z.string().min(1, "Target is required."),
    code: z.string().regex(/^\d{6}$/, "OTP code must be exactly 6 digits."),
    password: z
      .string()
      .regex(
        passwordStrengthRegex,
        "Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 digit, and 1 special character.",
      ),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotEmailSchema = z.object({
  countryCode: z.string().regex(/^\+\d{1,4}$/, "Country code must start with + and contain 1-4 digits."),
  mobile: z.string().regex(/^\d{6,15}$/, "Mobile number must be 6-15 digits."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterV2Input = z.infer<typeof registerV2Schema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ForgotEmailInput = z.infer<typeof forgotEmailSchema>;
