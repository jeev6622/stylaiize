import type { Request, Response } from "express";
import { asyncHandler, ok } from "@/utils/async-handler";
import * as recommendService from "@/application/services/recommend.service";
import * as wardrobeService from "@/application/services/wardrobe.service";
import * as memoryService from "@/application/services/memory.service";
import type { RecommendInput } from "@/api/validators/recommend.schema";

export const recommendController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as RecommendInput;
  const userId = req.user?.id ?? null;

  let wardrobeItems;
  if (userId) {
    try {
      wardrobeItems = await wardrobeService.getItems(userId);
    } catch {
      // Silently continue without wardrobe context
    }
  }

  let fashionMemory;
  if (userId) {
    try {
      fashionMemory = await memoryService.getMemory(userId);
    } catch {
      // Silently continue without fashion-memory context
    }
  }

  const result = await recommendService.getRecommendations({
    event: {
      name: input.event.name,
      date: input.event.date ?? null,
      time: input.event.time ?? null,
      venue: input.event.venue ?? null,
      dressCode: input.event.dressCode ?? null,
      theme: input.event.theme ?? null,
      indoorOutdoor: input.event.indoorOutdoor,
      category: input.event.category,
      notes: input.event.notes ?? null,
      weather: null,
      source: "manual",
    },
    wardrobeItems,
    fashionMemory,
  });

  ok(res, result);
});
