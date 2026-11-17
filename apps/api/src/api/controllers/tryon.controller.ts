import type { Request, Response } from "express";
import { asyncHandler, ok } from "@/utils/async-handler";
import { NotFoundError } from "@/utils/errors";
import {
  getTryOnStatus,
  tryOnGarment,
  getTryOnHealth,
  saveTryOnAsOutfit,
  saveTryOnToWardrobe,
  listTryOnResults,
  getTryOnResult,
  getTryOnResultImage,
  deleteTryOnResult,
} from "@/application/services/tryon.service";
import type { TryOnSchemaInput } from "@/api/validators/tryon.schema";
import {
  createTryOnJob,
  getTryOnJob,
} from "@/application/services/tryon-job.service";

/** GET /tryon/status — whether a real try-on backend is configured. */
export const getTryOnStatusController = asyncHandler(
  async (_req: Request, res: Response) => {
    ok(res, getTryOnStatus());
  },
);

/** GET /tryon/health — real backend reachability probe (no credentials exposed). */
export const getTryOnHealthController = asyncHandler(
  async (_req: Request, res: Response) => {
    ok(res, await getTryOnHealth());
  },
);

/** POST /tryon — run a virtual try-on through the backend gateway. */
export const tryOnController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as TryOnSchemaInput;
  const userId = req.user?.id ?? "";
  const result = await tryOnGarment({
    personImage: input.personImage,
    garmentImage: input.garmentImage,
    category: input.category,
    garmentLabel: input.garmentLabel,
    personUserId: userId,
  });
  ok(res, result);
});

/** POST /tryon/jobs - create an async try-on job with real provider progress. */
export const createTryOnJobController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as TryOnSchemaInput;
    const userId = req.user?.id ?? "";
    const job = createTryOnJob({
      personImage: input.personImage,
      garmentImage: input.garmentImage,
      category: input.category,
      garmentLabel: input.garmentLabel,
      userId,
    });
    ok(res, job);
  },
);

/** GET /tryon/jobs/:id - current status, stage, and real progress. */
export const getTryOnJobController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id ?? "";
    ok(res, getTryOnJob(userId, req.params.id));
  },
);

/** GET /tryon/results — list the current user's try-on history (metadata only). */
export const listResultsController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id ?? "";
  ok(res, { results: await listTryOnResults(userId) });
});

/** GET /tryon/results/:id — result metadata (no provider URLs or raw inputs). */
export const getResultController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id ?? "";
  const record = await getTryOnResult(userId, req.params.id);
  if (!record) throw new NotFoundError("Try-on result not found.");
  ok(res, {
    result: {
      id: record.id,
      provider: record.provider,
      category: record.category,
      garmentLabel: record.garmentLabel,
      processingTimeMs: record.processingTimeMs,
      createdAt: record.createdAt,
      imageUrl: `/api/v1/tryon/results/${record.id}/image`,
    },
  });
});

/** GET /tryon/results/:id/image — the generated try-on image (auth-gated). */
export const getResultImageController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id ?? "";
    const image = await getTryOnResultImage(userId, req.params.id);
    if (!image) throw new NotFoundError("Try-on result not found.");

    const mimeType = image.mimeType;
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="tryon-${req.params.id}.${mimeType.split("/")[1] ?? "png"}"`,
    );
    res.send(image.data);
  },
);

/** POST /tryon/save/outfit — persist a result as a saved outfit. */
export const saveAsOutfitController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id ?? "";
  const body = req.body as {
    resultId: string;
    name?: string;
    category?: string;
    occasion?: string | null;
    style?: string | null;
    colors?: string[];
    budget?: number | null;
  };
  const { id } = await saveTryOnAsOutfit({
    userId,
    resultId: body.resultId,
    name: body.name ?? "Virtual Try-On",
    category: body.category,
    occasion: body.occasion ?? null,
    style: body.style ?? null,
    colors: body.colors ?? [],
    budget: body.budget ?? null,
  });
  ok(res, { savedOutfitId: id });
});

/** POST /tryon/save/wardrobe — add the garment from a result to the wardrobe. */
export const saveToWardrobeController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id ?? "";
  const body = req.body as {
    resultId: string;
    name?: string;
    category?: string;
    color?: string;
    brand?: string | null;
    tags?: string[];
  };
  const { id } = await saveTryOnToWardrobe({
    userId,
    resultId: body.resultId,
    name: body.name ?? "Garment",
    category: body.category,
    color: body.color,
    brand: body.brand ?? null,
    tags: body.tags ?? [],
  });
  ok(res, { wardrobeItemId: id });
});

/** DELETE /tryon/results/:id — remove a result record. */
export const deleteResultController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id ?? "";
  await deleteTryOnResult(userId, req.params.id);
  ok(res, { deleted: true });
});
