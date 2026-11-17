import { Router } from "express";
import { apiRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import {
  createPackingListSchema,
  generatePackingListSchema,
  updatePackingListSchema,
} from "../validators/packing.schema";
import {
  createPackingListController,
  generatePackingListController,
  listPackingListsController,
  getPackingListController,
  updatePackingListController,
  deletePackingListController,
} from "../controllers/packing.controller";

const router = Router();

router.use(apiRateLimiter);

router.get("/", requireAuth, listPackingListsController);
router.post("/", requireAuth, validate(createPackingListSchema), createPackingListController);
router.post("/generate", requireAuth, validate(generatePackingListSchema), generatePackingListController);
router.get("/:id", requireAuth, getPackingListController);
router.patch("/:id", requireAuth, validate(updatePackingListSchema), updatePackingListController);
router.delete("/:id", requireAuth, deletePackingListController);

export default router;
