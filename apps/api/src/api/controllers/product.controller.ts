import type { Request, Response } from "express";
import { asyncHandler, ok } from "@/utils/async-handler";
import { NotFoundError } from "@/utils/errors";
import * as productService from "@/application/services/product.service";
import type {
  SearchProductsInput,
  CompareProductsInput,
} from "@/api/validators/product.schema";

export const searchProductsController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.query as unknown as SearchProductsInput;
    const result = await productService.searchProducts({
      query: input.query,
      category: input.category,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      sortBy: input.sortBy,
      page: input.page,
      limit: input.limit,
    });
    ok(res, result);
  },
);

export const compareProductsController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as CompareProductsInput;
    const result = await productService.compareProducts(input.productIds);
    ok(res, result);
  },
);

export const getProductController = asyncHandler(
  async (req: Request, res: Response) => {
    const product = await productService.getProductById(req.params.id);
    if (!product) throw new NotFoundError("Product not found.");
    ok(res, { product });
  },
);
