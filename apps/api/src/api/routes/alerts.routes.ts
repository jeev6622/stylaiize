import { Router } from "express";
import { apiRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { createAlertSchema, updateAlertSchema } from "../validators/alert.schema";
import {
  listAlertsController,
  createAlertController,
  updateAlertController,
  deleteAlertController,
  checkAlertsController,
} from "../controllers/alerts.controller";

const router = Router();

router.use(apiRateLimiter);

router.get("/", requireAuth, listAlertsController);
router.post("/", requireAuth, validate(createAlertSchema), createAlertController);
router.patch("/:id", requireAuth, validate(updateAlertSchema), updateAlertController);
router.delete("/:id", requireAuth, deleteAlertController);
router.post("/check", requireAuth, checkAlertsController);

export default router;