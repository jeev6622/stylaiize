import type { Request, Response } from "express";
import { asyncHandler, ok } from "@/utils/async-handler";
import { NotFoundError } from "@/utils/errors";
import { toPublicUser } from "@/utils/user";
import * as adminService from "@/application/services/admin.service";
import type { ListUsersInput, UpdateUserRoleInput } from "@/api/validators/admin.schema";

export const getStatsController = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await adminService.getStats();
  ok(res, { ...stats, recentUsers: (stats.recentUsers ?? []).map(toPublicUser) });
});

export const listUsersController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.query as unknown as ListUsersInput;
  const result = await adminService.listUsers(input);
  ok(res, {
    users: (result.users ?? []).map(toPublicUser),
    total: result.total,
  });
});

export const getUserController = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.getUser(req.params.id);
  if (!user) throw new NotFoundError("User not found.");
  ok(res, { user: toPublicUser(user) });
});

export const updateUserRoleController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as UpdateUserRoleInput;
  const user = await adminService.updateUserRole(req.params.id, input.role);
  if (!user) throw new NotFoundError("User not found.");
  ok(res, { user: toPublicUser(user) });
});

export const deleteUserController = asyncHandler(async (req: Request, res: Response) => {
  await adminService.deleteUser(req.params.id);
  ok(res, { deleted: true });
});
