import type { Request, Response } from "express";
import { asyncHandler, ok } from "@/utils/async-handler";
import { BadRequestError } from "@/utils/errors";
import * as styleProfileService from "@/application/services/style-profile.service";

/**
 * POST /style-profile/analyze - analyse an optional photo for styling cues.
 * The file is held in memory by multer and is never written to disk or logged.
 */
export const analyzeStyleProfileController = asyncHandler(
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      throw new BadRequestError(
        "Upload a photo to analyse.",
        "STYLE_PROFILE_IMAGE_REQUIRED",
      );
    }

    const styleProfile = await styleProfileService.analyzeStyleProfile({
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    ok(res, { styleProfile });
  },
);
