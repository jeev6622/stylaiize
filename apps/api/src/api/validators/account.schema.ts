import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty.").max(120).optional(),
  avatarUrl: z.string().trim().url("Avatar must be a valid URL.").max(2048).nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters.")
    .max(128),
});

export const registerDeviceTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, "Device token looks too short to be an FCM token.")
    .max(4096, "Device token is too long."),
});

export const unregisterDeviceTokenSchema = z.object({
  token: z.string().trim().min(1, "Device token is required.").max(4096),
});

export type UpdateProfileSchemaInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordSchemaInput = z.infer<typeof changePasswordSchema>;
export type RegisterDeviceTokenSchemaInput = z.infer<typeof registerDeviceTokenSchema>;
export type UnregisterDeviceTokenSchemaInput = z.infer<typeof unregisterDeviceTokenSchema>;
