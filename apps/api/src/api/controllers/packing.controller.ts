import type { Request, Response } from "express";
import { asyncHandler, ok, created } from "@/utils/async-handler";
import * as packingService from "@/application/services/packing.service";
import type {
  CreatePackingListSchemaInput,
  GeneratePackingListSchemaInput,
  UpdatePackingListSchemaInput,
} from "@/api/validators/packing.schema";

/** POST /packing — create a new packing list */
export const createPackingListController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as CreatePackingListSchemaInput;
    const list = await packingService.createList({
      userId: req.user!.id,
      title: input.title,
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    created(res, { list });
  },
);

/** POST /packing/generate — AI-generate a packing list */
export const generatePackingListController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as GeneratePackingListSchemaInput;
    const list = await packingService.generatePackingList(
      req.user!.id,
      input.destination,
      input.startDate ?? null,
      input.endDate ?? null,
      input.activities ?? [],
    );
    created(res, { list });
  },
);

/** GET /packing — list all packing lists for the current user */
export const listPackingListsController = asyncHandler(
  async (req: Request, res: Response) => {
    const lists = await packingService.getLists(req.user!.id);
    ok(res, { lists });
  },
);

/** GET /packing/:id — get a single packing list */
export const getPackingListController = asyncHandler(
  async (req: Request, res: Response) => {
    const list = await packingService.getList(req.user!.id, req.params.id);
    ok(res, { list });
  },
);

/** PATCH /packing/:id — update a packing list */
export const updatePackingListController = asyncHandler(
  async (req: Request, res: Response) => {
    const patch = req.body as UpdatePackingListSchemaInput;
    const list = await packingService.updateList(req.user!.id, req.params.id, patch);
    ok(res, { list });
  },
);

/** DELETE /packing/:id — delete a packing list */
export const deletePackingListController = asyncHandler(
  async (req: Request, res: Response) => {
    await packingService.deleteList(req.user!.id, req.params.id);
    ok(res, { deleted: true });
  },
);
