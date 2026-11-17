import { Router } from "express";
import { recommendRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import {
  generateBuildLookSchema,
  replaceBuildLookItemSchema,
  addBuildLookItemSchema,
} from "../validators/build-look.schema";
import {
  generateLookController,
  replaceItemController,
  addItemController,
} from "../controllers/build-look.controller";

const router = Router();

router.use(recommendRateLimiter);
router.use(requireAuth);

router.post("/generate", validate(generateBuildLookSchema), generateLookController);
router.post("/replace-item", validate(replaceBuildLookItemSchema), replaceItemController);
router.post("/add-item", validate(addBuildLookItemSchema), addItemController);

export default router;