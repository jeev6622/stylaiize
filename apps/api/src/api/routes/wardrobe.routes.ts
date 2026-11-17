import { Router } from "express";
import { apiRateLimiter, uploadRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { uploadSingleImage } from "../middleware/upload.middleware";
import {
  createWardrobeItemSchema,
  updateWardrobeItemSchema,
  listWardrobeQuerySchema,
} from "../validators/wardrobe.schema";
import {
  createWardrobeItemController,
  listWardrobeItemsController,
  getWardrobeItemController,
  updateWardrobeItemController,
  deleteWardrobeItemController,
  getWardrobeSummaryController,
  categorizeWardrobeItemController,
  uploadWardrobeImageController,
  markWardrobeItemWornController,
} from "../controllers/wardrobe.controller";

const router = Router();

router.use(apiRateLimiter);

// Static segments must be registered before `/:id` so they are not swallowed
// by the parameterised routes.
router.get("/summary", requireAuth, getWardrobeSummaryController);
router.post("/upload", requireAuth, uploadRateLimiter, uploadSingleImage, uploadWardrobeImageController);
router.post("/categorize", requireAuth, uploadRateLimiter, uploadSingleImage, categorizeWardrobeItemController);

router.get("/", requireAuth, validate(listWardrobeQuerySchema, "query"), listWardrobeItemsController);
router.post("/", requireAuth, validate(createWardrobeItemSchema), createWardrobeItemController);
router.get("/:id", requireAuth, getWardrobeItemController);
router.patch("/:id", requireAuth, validate(updateWardrobeItemSchema), updateWardrobeItemController);
router.post("/:id/wear", requireAuth, markWardrobeItemWornController);
router.delete("/:id", requireAuth, deleteWardrobeItemController);

export default router;
