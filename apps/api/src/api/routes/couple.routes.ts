import { Router } from "express";
import { apiRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { coupleStyleSchema } from "../validators/couple.schema";
import { coupleStyleController } from "../controllers/couple.controller";

const router = Router();

router.use(apiRateLimiter);

router.post("/style", requireAuth, validate(coupleStyleSchema), coupleStyleController);

export default router;