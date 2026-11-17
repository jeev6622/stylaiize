import type { Request, Response } from "express";
import { asyncHandler, ok } from "@/utils/async-handler";
import * as sustainabilityService from "@/application/services/sustainability.service";

/** GET /sustainability — compute a report from the user's real wardrobe data. */
export const sustainabilityController = asyncHandler(async (req: Request, res: Response) => {
  const report = await sustainabilityService.getSustainabilityReport(req.user!.id);
  ok(res, { report });
});