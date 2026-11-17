import type { Request, Response } from "express";
import { asyncHandler, created } from "@/utils/async-handler";
import * as groupService from "@/application/services/group.service";
import type { GroupStyleInput } from "@/api/validators/group.schema";

/** POST /group/style — generate a coordinated group look. */
export const groupStyleController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as GroupStyleInput;
  const result = await groupService.generateGroupStyle({
    members: input.members,
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