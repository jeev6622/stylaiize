import { Router } from "express";
import { apiRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import {
  createSavedOutfitSchema,
  updateSavedOutfitSchema,
} from "../validators/saved-outfit.schema";
import {
  listSavedOutfitsController,
  getSavedOutfitController,
  createSavedOutfitController,
  updateSavedOutfitController,
  deleteSavedOutfitController,
  regenerateSavedOutfitController,
} from "../controllers/saved-outfit.controller";

const router = Router();

router.use(apiRateLimiter);
router.use(requireAuth);

router.get("/", listSavedOutfitsController);
router.post("/", validate(createSavedOutfitSchema), createSavedOutfitController);
router.get("/:id", getSavedOutfitController);
router.post("/:id/regenerate", regenerateSavedOutfitController);
router.patch("/:id", validate(updateSavedOutfitSchema), updateSavedOutfitController);
router.delete("/:id", deleteSavedOutfitController);

export default router;
