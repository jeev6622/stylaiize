import { Router } from "express";
import { apiRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import {
  searchProductsSchema,
  productModel3dQuerySchema,
  compareProductsSchema,
} from "../validators/product.schema";
import {
  searchProductsController,
  compareProductsController,
  shoppingStatusController,
  getProductController,
  getProductModel3dController,
} from "../controllers/product.controller";

const router = Router();
router.use(apiRateLimiter);

router.get(
  "/",
  validate(searchProductsSchema, "query"),
  searchProductsController,
);
router.get("/shopping-status", shoppingStatusController);
router.get(
  "/model-3d",
  validate(productModel3dQuerySchema, "query"),
  getProductModel3dController,
);
router.get("/:id", getProductController);
router.post(
  "/compare",
  validate(compareProductsSchema),
  compareProductsController,
);

export default router;
