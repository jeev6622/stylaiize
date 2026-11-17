import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { getDashboardSummaryController } from "../controllers/dashboard.controller";

const router = Router();

router.use(requireAuth);

router.get("/", getDashboardSummaryController);

export default router;