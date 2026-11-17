import { Router } from "express";
import { apiRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import {
  tryOnSchema,
  saveTryOnAsOutfitSchema,
  saveTryOnToWardrobeSchema,
} from "../validators/tryon.schema";
import {
  getTryOnStatusController,
  tryOnController,
  createTryOnJobController,
  getTryOnJobController,
  getTryOnHealthController,
  listResultsController,
  getResultController,
  getResultImageController,
  saveAsOutfitController,
  saveToWardrobeController,
  deleteResultController,
} from "../controllers/tryon.controller";

const router = Router();

router.use(apiRateLimiter);
router.use(requireAuth);

router.get("/status", getTryOnStatusController);
router.get("/health", getTryOnHealthController);

router.post("/jobs", validate(tryOnSchema), createTryOnJobController);
router.get("/jobs/:id", getTryOnJobController);

router.get("/results", listResultsController);
router.get("/results/:id", getResultController);
router.get("/results/:id/image", getResultImageController);
router.delete("/results/:id", deleteResultController);

router.post("/save/outfit", validate(saveTryOnAsOutfitSchema), saveAsOutfitController);
router.post("/save/wardrobe", validate(saveTryOnToWardrobeSchema), saveToWardrobeController);

router.post("/", validate(tryOnSchema), tryOnController);

export default router;