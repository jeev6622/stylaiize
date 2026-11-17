/**
 * Image upload middleware.
 *
 * Holds the file in memory only (the storage provider writes it), enforces an
 * allow-list of image MIME types, and caps the size so a single request cannot
 * exhaust the process heap.
 */
import multer from "multer";
import { env } from "@/config/env";
import { AppError } from "@/utils/errors";

/** Only real raster images are accepted; SVG is excluded (scriptable). */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const MAX_IMAGE_UPLOAD_BYTES = Math.floor(env.AI_MAX_IMAGE_CHARS * 0.75);

/**
 * Style-profile photos are used once for colour/grooming personalisation.
 * They have a stricter allow-list than general uploads: no GIF/AVIF.
 */
export const STYLE_PROFILE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

function createSingleImageUpload(allowedMimeTypes: readonly string[]) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_IMAGE_UPLOAD_BYTES,
      files: 1,
      fields: 10,
    },
    fileFilter: (_req, file, cb) => {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        cb(
          new AppError(
            415,
            `Unsupported image type "${file.mimetype}". Allowed: ${allowedMimeTypes.join(", ")}.`,
            { code: "UNSUPPORTED_IMAGE_TYPE" },
          ),
        );
        return;
      }
      cb(null, true);
    },
  });
  return upload.single("image");
}

/** Single-image upload middleware. */
export const uploadSingleImage = createSingleImageUpload(ALLOWED_IMAGE_MIME_TYPES);

/** Single-image upload for the optional style-profile photo (jpeg/png/webp). */
export const uploadSingleStyleProfileImage = createSingleImageUpload(
  STYLE_PROFILE_IMAGE_MIME_TYPES,
);
