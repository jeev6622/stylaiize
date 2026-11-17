import type { Request, Response } from "express";
import { asyncHandler, ok, created } from "@/utils/async-handler";
import { BadRequestError } from "@/utils/errors";
import * as wardrobeService from "@/application/services/wardrobe.service";
import type {
  CreateWardrobeItemSchemaInput,
  UpdateWardrobeItemSchemaInput,
  ListWardrobeQuerySchemaInput,
} from "@/api/validators/wardrobe.schema";

/** POST /wardrobe — create a new wardrobe item */
export const createWardrobeItemController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as CreateWardrobeItemSchemaInput;
    const item = await wardrobeService.createItem(req.user!.id, {
      name: input.name,
      category: input.category,
      color: input.color,
      imageUrl: input.imageUrl,
      imageUploadToken: input.imageUploadToken,
      brand: input.brand,
      purchasedPrice: input.purchasedPrice,
      tags: input.tags,
    });
    created(res, { item });
  },
);

/** GET /wardrobe?category=&search=&sort= — list items with search and sorting */
export const listWardrobeItemsController = asyncHandler(
  async (req: Request, res: Response) => {
    // Query shape is enforced by `validate(listWardrobeQuerySchema)` in the route.
    const query = req.query as unknown as ListWardrobeQuerySchemaInput;

    const items = await wardrobeService.listItems(req.user!.id, {
      category: query.category,
      search: query.search,
      sort: query.sort,
    });
    ok(res, { items });
  },
);

/** GET /wardrobe/summary — get wardrobe summary */
export const getWardrobeSummaryController = asyncHandler(
  async (req: Request, res: Response) => {
    const summary = await wardrobeService.getWardrobeSummary(req.user!.id);
    ok(res, summary);
  },
);

/**
 * POST /wardrobe/categorize — identify a garment from an uploaded photo.
 * Returns a draft the user can review and edit before saving.
 */
export const categorizeWardrobeItemController = asyncHandler(
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      throw new BadRequestError("An image file is required.", "IMAGE_REQUIRED");
    }
    const draft = await wardrobeService.categorizeImage(req.user!.id, {
      buffer: file.buffer,
      mimeType: file.mimetype,
      filename: file.originalname,
    });
    ok(res, { draft });
  },
);

/** POST /wardrobe/upload — store an image and return its URL plus a claim token */
export const uploadWardrobeImageController = asyncHandler(
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      throw new BadRequestError("An image file is required.", "IMAGE_REQUIRED");
    }
    const { imageUrl, imageUploadToken } = await wardrobeService.attachImage(
      req.user!.id,
      { buffer: file.buffer, mimeType: file.mimetype, filename: file.originalname },
    );
    created(res, { imageUrl, imageUploadToken });
  },
);

/** GET /wardrobe/:id — get a single item */
export const getWardrobeItemController = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await wardrobeService.getItem(req.user!.id, req.params.id);
    ok(res, { item });
  },
);

/** PATCH /wardrobe/:id — update an item */
export const updateWardrobeItemController = asyncHandler(
  async (req: Request, res: Response) => {
    const patch = req.body as UpdateWardrobeItemSchemaInput;
    const item = await wardrobeService.updateItem(req.user!.id, req.params.id, patch);
    ok(res, { item });
  },
);

/** POST /wardrobe/:id/wear — record that the item was worn today */
export const markWardrobeItemWornController = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await wardrobeService.markWorn(req.user!.id, req.params.id);
    ok(res, { item });
  },
);

/** DELETE /wardrobe/:id — delete an item */
export const deleteWardrobeItemController = asyncHandler(
  async (req: Request, res: Response) => {
    await wardrobeService.deleteItem(req.user!.id, req.params.id);
    ok(res, { deleted: true });
  },
);
