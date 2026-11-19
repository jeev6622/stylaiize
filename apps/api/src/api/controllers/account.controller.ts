import type { Request, Response } from "express";
import { asyncHandler, created, ok } from "@/utils/async-handler";
import { toPublicUser } from "@/utils/user";
import {
  changePassword,
  getAccountSummary,
  getFavourites,
  getNotificationStatus,
  registerDeviceToken,
  removeFavourite,
  saveFavourite,
  unregisterDeviceToken,
  updateProfile,
} from "@/application/services/account.service";
import type {
  ChangePasswordSchemaInput,
  RegisterDeviceTokenSchemaInput,
  SaveFavouriteSchemaInput,
  UnregisterDeviceTokenSchemaInput,
  UpdateProfileSchemaInput,
} from "@/api/validators/account.schema";

/** GET /account — profile summary + stats */
export const getAccountController = asyncHandler(async (req: Request, res: Response) => {
  const summary = await getAccountSummary(req.user!.id);
  ok(res, summary);
});

/** PATCH /account — update name / avatar */
export const updateProfileController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as UpdateProfileSchemaInput;
    const user = await updateProfile(req.user!.id, input);
    ok(res, { user: toPublicUser(user) });
  },
);

/** POST /account/change-password — change the account password */
export const changePasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as ChangePasswordSchemaInput;
    const result = await changePassword(req.user!.id, input);
    ok(res, result);
  },
);

/** POST /account/device-tokens — register an FCM token for push notifications */
export const registerDeviceTokenController = asyncHandler(
  async (req: Request, res: Response) => {
    const { token } = req.body as RegisterDeviceTokenSchemaInput;
    const result = await registerDeviceToken(req.user!.id, token);
    created(res, result);
  },
);

/** DELETE /account/device-tokens — remove a registered FCM token */
export const unregisterDeviceTokenController = asyncHandler(
  async (req: Request, res: Response) => {
    const { token } = req.body as UnregisterDeviceTokenSchemaInput;
    const result = await unregisterDeviceToken(req.user!.id, token);
    ok(res, result);
  },
);

/** GET /account/notifications/status — push delivery capability + device count */
export const getNotificationStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const status = await getNotificationStatus(req.user!.id);
    ok(res, status);
  },
);

/** GET /account/favourites — saved product snapshots */
export const getFavouritesController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFavourites(req.user!.id);
    ok(res, result);
  },
);

/** POST /account/favourites — save a product snapshot */
export const saveFavouriteController = asyncHandler(
  async (req: Request, res: Response) => {
    const { product } = req.body as SaveFavouriteSchemaInput;
    const result = await saveFavourite(req.user!.id, product);
    created(res, result);
  },
);

/** DELETE /account/favourites/:id — remove a saved product snapshot */
export const removeFavouriteController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await removeFavourite(req.user!.id, req.params.id);
    ok(res, result);
  },
);
