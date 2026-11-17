import { Router } from "express";
import { apiRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import {
  saveStyleProfileSchema,
  updateMemorySchema,
} from "../validators/memory.schema";
import {
  getMemoryController,
  saveStyleProfileController,
  updateMemoryController,
} from "../controllers/memory.controller";

const router = Router();

router.use(apiRateLimiter);

router.get("/", requireAuth, getMemoryController);
router.patch("/", requireAuth, validate(updateMemorySchema), updateMemoryController);
router.put(
  "/style-profile",
  requireAuth,
  validate(saveStyleProfileSchema),
  saveStyleProfileController,
);

export default router;