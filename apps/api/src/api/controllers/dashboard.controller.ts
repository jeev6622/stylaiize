import type { Request, Response } from "express";
import { asyncHandler, ok } from "@/utils/async-handler";
import * as dashboardService from "@/application/services/dashboard.service";

export const getDashboardSummaryController = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? "";
  const summary = await dashboardService.getDashboardSummary(userId);
  ok(res, summary);
});