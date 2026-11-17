import { Router } from "express";
import { uploadRateLimiter } from "../middleware/rate-limit";
import { requireAuth } from "../middleware/auth.middleware";
import { uploadSingleStyleProfileImage } from "../middleware/upload.middleware";
import { analyzeStyleProfileController } from "../controllers/style-profile.controller";

const router = Router();

router.use(uploadRateLimiter);
router.use(requireAuth);

router.post("/analyze", uploadSingleStyleProfileImage, analyzeStyleProfileController);

export default router;
