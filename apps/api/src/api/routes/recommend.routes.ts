import { Router } from "express";
import { recommendRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { optionalAuth } from "../middleware/auth.middleware";
import { recommendSchema } from "../validators/recommend.schema";
import { recommendController } from "../controllers/recommend.controller";

const router = Router();
router.use(recommendRateLimiter);
router.post("/", optionalAuth, validate(recommendSchema), recommendController);

export default router;
