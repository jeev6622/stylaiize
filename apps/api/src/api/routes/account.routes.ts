import { Router } from "express";
import { apiRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import {
  changePasswordSchema,
  registerDeviceTokenSchema,
  saveFavouriteSchema,
  unregisterDeviceTokenSchema,
  updateProfileSchema,
} from "../validators/account.schema";
import {
  changePasswordController,
  getAccountController,
  getFavouritesController,
  getNotificationStatusController,
  registerDeviceTokenController,
  removeFavouriteController,
  saveFavouriteController,
  unregisterDeviceTokenController,
  updateProfileController,
} from "../controllers/account.controller";

const router = Router();

router.use(apiRateLimiter);
router.use(requireAuth);

router.get("/", getAccountController);
router.patch("/", validate(updateProfileSchema), updateProfileController);
router.post("/change-password", validate(changePasswordSchema), changePasswordController);
router.get("/favourites", getFavouritesController);
router.post("/favourites", validate(saveFavouriteSchema), saveFavouriteController);
router.delete("/favourites/:id", removeFavouriteController);
router.post(
  "/device-tokens",
  validate(registerDeviceTokenSchema),
  registerDeviceTokenController,
);
router.delete(
  "/device-tokens",
  validate(unregisterDeviceTokenSchema),
  unregisterDeviceTokenController,
);
router.get("/notifications/status", getNotificationStatusController);

export default router;
