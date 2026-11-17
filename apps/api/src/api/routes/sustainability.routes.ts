import { Router } from "express";
import { apiRateLimiter } from "../middleware/rate-limit";
import { requireAuth } from "../middleware/auth.middleware";
import { sustainabilityController } from "../controllers/sustainability.controller";

const router = Router();

router.use(apiRateLimiter);

router.get("/", requireAuth, sustainabilityController);

export default router;