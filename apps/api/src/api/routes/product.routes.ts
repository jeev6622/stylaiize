import { Router } from "express";
import { apiRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import {
  searchProductsSchema,
  compareProductsSchema,
} from "../validators/product.schema";
import {
  searchProductsController,
  compareProductsController,
  getProductController,
} from "../controllers/product.controller";

const router = Router();
router.use(apiRateLimiter);

router.get(
  "/",
  validate(searchProductsSchema, "query"),
  searchProductsController,
);
router.get("/:id", getProductController);
router.post(
  "/compare",
  validate(compareProductsSchema),
  compareProductsController,
);

export default router;
