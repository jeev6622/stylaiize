import type { Request, Response } from "express";
import { asyncHandler, created } from "@/utils/async-handler";
import * as coupleService from "@/application/services/couple.service";
import type { CoupleStyleInput } from "@/api/validators/couple.schema";

/** POST /couple/style — generate a coordinated couple look. */
export const coupleStyleController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CoupleStyleInput;
  const result = await coupleService.generateCoupleStyle({
    memberA: input.memberA,
    memberB: input.memberB,
    event: {
      name: input.event.name,
      category: input.event.category ?? "other",
      dressCode: input.event.dressCode ?? null,
      venue: input.event.venue ?? null,
      date: null,
      time: null,
      theme: null,
      indoorOutdoor: "unknown",
      source: "manual",
      notes: null,
      weather: null,
    },
    budget: input.budget,
  });
  created(res, { result });
});