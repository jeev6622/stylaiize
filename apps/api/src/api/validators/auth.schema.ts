import { z } from "zod";
import { OTP_PURPOSES } from "@stylaiize/shared";
import { isValidEmail, isValidIndianMobile, isValidPassword, normalizeIndianMobile } from "@stylaiize/shared";

const strictEmail = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidEmail, "Enter a valid email address.");

const indianMobile = z
  .string()
  .trim()
  .refine(isValidIndianMobile, "Enter a valid 10-digit Indian mobile number.")
  .transform((value) => normalizeIndianMobile(value) as string);

const strongPassword = z
  .string()
  .refine(isValidPassword, {
    message:
      "Password must be 8 to 128 characters and include uppercase, lowercase, digit, and special character.",
  });

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  email: strictEmail,
  password: strongPassword,
});

export const registerStartSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
    email: strictEmail,
    password: strongPassword,
    confirmPassword: z.string().min(1, "Please confirm your password."),
    mobile: indianMobile,
    countryCode: z.literal("+91", {
      errorMap: () => ({ message: "Only Indian +91 mobile numbers are supported." }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const registerV2Schema = registerStartSchema;

export const registrationIdSchema = z.object({
  registrationId: z.string().trim().min(1, "Registration session is required."),
});

export const registrationResendSchema = z.object({
  registrationId: z.string().trim().min(1, "Registration session is required."),
  channel: z.enum(["email", "mobile"]),
});

export const registrationVerifySchema = z.object({
  registrationId: z.string().trim().min(1, "Registration session is required."),
  channel: z.enum(["email", "mobile"]),
  code: z.string().regex(/^\d{6}$/, "OTP code must be exactly 6 digits."),
});

export const loginSchema = z.union([
  z.object({
    email: strictEmail,
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

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const sendOtpSchema = z.object({
  purpose: z.enum(OTP_PURPOSES),
  email: strictEmail.optional(),
  mobile: z.string().regex(/^\d{6,15}$/, "Mobile number must be 6-15 digits.").optional(),
  countryCode: z.string().regex(/^\+\d{1,4}$/, "Country code must start with + and contain 1-4 digits.").optional(),
});

export const sendLoginOtpSchema = z.object({
  email: strictEmail,
});

export const verifyLoginOtpSchema = z.object({
  email: strictEmail,
  code: z.string().regex(/^\d{6}$/, "OTP code must be exactly 6 digits."),
  rememberMe: z.boolean().optional().default(false),
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
    password: strongPassword,
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
export type RegisterV2Input = z.infer<typeof registerStartSchema>;
export type RegistrationIdInput = z.infer<typeof registrationIdSchema>;
export type RegistrationResendInput = z.infer<typeof registrationResendSchema>;
export type RegistrationVerifyInput = z.infer<typeof registrationVerifySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type SendLoginOtpInput = z.infer<typeof sendLoginOtpSchema>;
export type VerifyLoginOtpInput = z.infer<typeof verifyLoginOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ForgotEmailInput = z.infer<typeof forgotEmailSchema>;
