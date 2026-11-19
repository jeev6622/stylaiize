import { Router } from "express";
import { recommendRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import {
  generateBuildLookSchema,
  replaceBuildLookItemSchema,
  addBuildLookItemSchema,
  shopBuildLookSchema,
  completeOutfitImageSchema,
} from "../validators/build-look.schema";
import {
  generateLookController,
  replaceItemController,
  addItemController,
  shopLookController,
  completeOutfitImageController,
} from "../controllers/build-look.controller";

const router = Router();

router.use(recommendRateLimiter);
router.use(requireAuth);

router.post("/generate", validate(generateBuildLookSchema), generateLookController);
router.post("/replace-item", validate(replaceBuildLookItemSchema), replaceItemController);
router.post("/add-item", validate(addBuildLookItemSchema), addItemController);
router.post("/shop", validate(shopBuildLookSchema), shopLookController);
router.post(
  "/complete-outfit-image",
  validate(completeOutfitImageSchema),
  completeOutfitImageController,
);

export default router;