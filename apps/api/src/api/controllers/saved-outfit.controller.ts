import type { Request, Response } from "express";
import { asyncHandler, ok, created } from "@/utils/async-handler";
import * as savedOutfitService from "@/application/services/saved-outfit.service";
import type {
  CreateSavedOutfitInput,
  UpdateSavedOutfitInput,
} from "@/api/validators/saved-outfit.schema";

/** GET /outfits — list all saved outfits for the current user */
export const listSavedOutfitsController = asyncHandler(
  async (req: Request, res: Response) => {
    const outfits = await savedOutfitService.listSavedOutfits(req.user!.id);
    ok(res, { outfits });
  },
);

/** GET /outfits/:id — get a single saved outfit */
export const getSavedOutfitController = asyncHandler(
  async (req: Request, res: Response) => {
    const outfit = await savedOutfitService.getSavedOutfit(req.user!.id, req.params.id);
    ok(res, { outfit });
  },
);

/** POST /outfits — save a new outfit */
export const createSavedOutfitController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as CreateSavedOutfitInput;
    const outfit = await savedOutfitService.createSavedOutfit({
      ...input,
      userId: req.user!.id,
    });
    created(res, { outfit });
  },
);

/** PATCH /outfits/:id — update a saved outfit */
export const updateSavedOutfitController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as UpdateSavedOutfitInput;
    const outfit = await savedOutfitService.updateSavedOutfit(
      req.user!.id,
      req.params.id,
      input,
    );
    ok(res, { outfit });
  },
);

/** DELETE /outfits/:id — delete a saved outfit */
export const deleteSavedOutfitController = asyncHandler(
  async (req: Request, res: Response) => {
    await savedOutfitService.deleteSavedOutfit(req.user!.id, req.params.id);
    ok(res, { deleted: true });
  },
);

/** POST /outfits/:id/regenerate — re-run AI on a saved outfit in place */
export const regenerateSavedOutfitController = asyncHandler(
  async (req: Request, res: Response) => {
    const outfit = await savedOutfitService.regenerateSavedOutfit(
      req.user!.id,
      req.params.id,
    );
    ok(res, { outfit, message: "Outfit regenerated." });
  },
);
