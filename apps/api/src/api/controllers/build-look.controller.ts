import type { Request, Response } from "express";
import { asyncHandler, ok } from "@/utils/async-handler";
import * as buildLookService from "@/application/services/build-look.service";
import * as completeOutfitImageService from "@/application/services/complete-outfit-image.service";
import { shopBuildLookItems } from "@/application/services/product.service";
import type {
  GenerateBuildLookInput,
  ReplaceBuildLookItemInput,
  AddBuildLookItemInput,
  ShopBuildLookInput,
  CompleteOutfitImageInput,
} from "@/api/validators/build-look.schema";

/** POST /build-look/generate — generate a complete AI-crafted look. */
export const generateLookController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as GenerateBuildLookInput;
  const { look, grooming } = await buildLookService.generateLook({
    eventName: input.eventName,
    audience: input.audience,
    occasion: input.occasion,
    dressCode: input.dressCode,
    style: input.style,
    budget: input.budget,
    colors: input.colors,
    fit: input.fit,
    brand: input.brand,
    season: input.season,
    weather: input.weather,
    includeGrooming: input.includeGrooming,
    styleProfile: input.styleProfile,
    userId: req.user!.id,
  });
  ok(res, grooming ? { look, grooming } : { look });
});

/** POST /build-look/replace-item — swap one item while keeping the rest intact. */
export const replaceItemController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as ReplaceBuildLookItemInput;
  const look = await buildLookService.replaceItem({
    eventName: input.eventName,
    audience: input.audience,
    occasion: input.occasion,
    dressCode: input.dressCode,
    style: input.style,
    budget: input.budget,
    colors: input.colors,
    fit: input.fit,
    brand: input.brand,
    season: input.season,
    weather: input.weather,
    currentItems: input.currentItems,
    itemId: input.itemId,
    reason: input.reason,
  });
  ok(res, { look });
});

/** POST /build-look/add-item — add one complementary item to the current look. */
export const addItemController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as AddBuildLookItemInput;
  const look = await buildLookService.addItem({
    eventName: input.eventName,
    audience: input.audience,
    occasion: input.occasion,
    dressCode: input.dressCode,
    style: input.style,
    budget: input.budget,
    colors: input.colors,
    fit: input.fit,
    brand: input.brand,
    season: input.season,
    weather: input.weather,
    currentItems: input.currentItems,
    category: input.category,
    reason: input.reason,
  });
  ok(res, { look });
});

/** POST /build-look/shop — find real listings for the current styling guidance. */
export const shopLookController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as ShopBuildLookInput;
  const result = await shopBuildLookItems(input.items, {
    audience: input.audience,
    occasion: input.occasion,
    style: input.style,
    budget: input.budget,
    pinCode: input.pinCode,
  });
  ok(res, result);
});

export const completeOutfitImageController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CompleteOutfitImageInput;
  const result = await completeOutfitImageService.generateCompleteOutfitImage(input);
  ok(res, result);
});