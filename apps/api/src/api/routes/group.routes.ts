import { Router } from "express";
import { apiRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { groupStyleSchema } from "../validators/group.schema";
import { groupStyleController } from "../controllers/group.controller";

const router = Router();

router.use(apiRateLimiter);

router.post("/style", requireAuth, validate(groupStyleSchema), groupStyleController);

export default router;