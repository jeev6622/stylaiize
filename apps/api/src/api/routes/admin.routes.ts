import { Router } from "express";
import { adminRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware";
import { listUsersSchema, updateUserRoleSchema } from "../validators/admin.schema";
import {
  getStatsController,
  listUsersController,
  getUserController,
  updateUserRoleController,
  deleteUserController,
} from "../controllers/admin.controller";

const router = Router();

router.use(adminRateLimiter);
router.use(requireAuth, requireAdmin);

router.get("/stats", getStatsController);
router.get("/users", validate(listUsersSchema, "query"), listUsersController);
router.get("/users/:id", getUserController);
router.patch("/users/:id/role", validate(updateUserRoleSchema), updateUserRoleController);
router.delete("/users/:id", deleteUserController);

export default router;
