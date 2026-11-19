import type { Request, Response } from "express";
import { asyncHandler, ok } from "@/utils/async-handler";
import { AppError, NotFoundError } from "@/utils/errors";
import { env } from "@/config/env";
import * as productService from "@/application/services/product.service";
import {
  downloadSecureAsset,
  ImageFetchError,
} from "@/infrastructure/outfit-image/secure-image-fetch";
import type {
  SearchProductsInput,
  ProductModel3dQuery,
  CompareProductsInput,
} from "@/api/validators/product.schema";

const ALLOWED_MODEL_TYPES = new Set(["model/gltf-binary", "application/octet-stream"]);

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
      pinCode: input.pinCode,
      audience: input.audience,
      style: input.style,
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

export const shoppingStatusController = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, productService.getShoppingStatus());
});

export const getProductController = asyncHandler(
  async (req: Request, res: Response) => {
    const product = await productService.getProductById(req.params.id);
    if (!product) throw new NotFoundError("Product not found.");
    ok(res, { product, demoMode: productService.getShoppingStatus().demoMode });
  },
);

export const getProductModel3dController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.query as unknown as ProductModel3dQuery;
    try {
      const asset = await downloadSecureAsset(input.url, {
        maxBytes: env.MODEL3D_MAX_DOWNLOAD_BYTES,
        timeoutMs: env.MODEL3D_DOWNLOAD_TIMEOUT_MS,
        allowedContentTypes: ALLOWED_MODEL_TYPES,
        accept: "model/gltf-binary,application/octet-stream",
        label: "3D model",
      });
      res
        .status(200)
        .set({
          "Content-Type": "model/gltf-binary",
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        })
        .send(asset.buffer);
    } catch (error) {
      if (error instanceof ImageFetchError) {
        throw new AppError(422, "The 3D product model could not be loaded.", {
          code: `MODEL3D_${error.code}`,
          cause: error,
        });
      }
      throw error;
    }
  },
);
