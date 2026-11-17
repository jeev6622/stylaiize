import type { Request, Response } from "express";
import { asyncHandler, ok } from "@/utils/async-handler";
import * as memoryService from "@/application/services/memory.service";
import type {
  SaveStyleProfileInput,
  UpdateMemoryInput,
} from "@/api/validators/memory.schema";

/** GET /memory — return the user's fashion memory (creating a default if absent). */
export const getMemoryController = asyncHandler(async (req: Request, res: Response) => {
  const memory = await memoryService.getMemory(req.user!.id);
  ok(res, { memory });
});

/** PATCH /memory — update fashion memory fields in place. */
export const updateMemoryController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as UpdateMemoryInput;
  const memory = await memoryService.updateMemory(req.user!.id, input);
  ok(res, { memory });
});

/** PUT /memory/style-profile — opt-in save of a reviewed style profile. */
export const saveStyleProfileController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as SaveStyleProfileInput;
    const memory = await memoryService.saveStyleProfile(
      req.user!.id,
      input.styleProfile,
    );
    ok(res, { memory });
  },
);