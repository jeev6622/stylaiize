import { Router } from "express";
import { healthController, livenessController } from "../controllers/health.controller";

const router = Router();

router.get("/healthz", livenessController);
router.get("/health", healthController);

export default router;
