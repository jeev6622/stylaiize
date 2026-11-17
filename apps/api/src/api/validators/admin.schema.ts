import { z } from "zod";

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  role: z.enum(["user", "admin"]).optional(),
  search: z.string().trim().max(100).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["user", "admin"]),
});

export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
