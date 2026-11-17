/**
 * Application service for file storage.
 * Controllers call this instead of reaching into the storage provider.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveStorageProvider } from "@/infrastructure/storage/factory";
import { AppError, BadRequestError } from "@/utils/errors";
import { env } from "@/config/env";
import { logError } from "@/utils/logger";
import type { UploadResult } from "@/infrastructure/storage/storage.interface";

export interface SaveImageInput {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  folder: string;
}

export async function saveImage(input: SaveImageInput): Promise<UploadResult> {
  const storage = resolveStorageProvider();
  try {
    return await storage.upload({
      filename: input.filename,
      mimeType: input.mimeType,
      buffer: input.buffer,
      folder: input.folder,
    });
  } catch (err) {
    logError("Image upload failed", err instanceof Error ? err : new Error(String(err)));
    throw new AppError(502, "The image could not be stored. Please try again.", {
      code: "STORAGE_UPLOAD_ERROR",
      cause: err,
    });
  }
}

export async function deleteImage(publicId: string): Promise<void> {
  try {
    await resolveStorageProvider().delete(publicId);
  } catch (err) {
    // A failed cleanup must not fail the user's request.
    logError("Image delete failed", err instanceof Error ? err : new Error(String(err)));
  }
}

// ---------------------------------------------------------------------------
// Upload tokens
// ---------------------------------------------------------------------------

/**
 * An uploaded image is stored before the wardrobe item that references it
 * exists, so the client needs a way to hand the new asset back to us.
 *
 * Sending the raw `publicId` would let a caller name (and later have us delete)
 * any asset, including another user's, so instead we return an HMAC token bound
 * to the uploading user. The service resolves the token back to `{ url,
 * publicId }` and the id never leaves the server.
 */
export interface StoredImage {
  url: string;
  publicId: string;
  token: string;
}

function sign(publicId: string, userId: string): string {
  return createHmac("sha256", env.JWT_ACCESS_SECRET)
    .update(`${userId}:${publicId}`)
    .digest("base64url");
}

export function createUploadToken(publicId: string, url: string, userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ p: publicId, u: url }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${sign(publicId, userId)}`;
}

/**
 * Resolves a token produced by {@link createUploadToken}.
 * Throws {@link BadRequestError} when the token is malformed, forged, or was
 * issued to a different user.
 */
export function resolveUploadToken(token: string, userId: string): StoredImage {
  const fail = (): never => {
    throw new BadRequestError(
      "The uploaded image could not be verified. Please upload it again.",
      "INVALID_IMAGE_TOKEN",
    );
  };

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return fail();

  let payload: { p?: unknown; u?: unknown };
  try {
    payload = JSON.parse(
      Buffer.from(token.slice(0, dot), "base64url").toString("utf8"),
    ) as { p?: unknown; u?: unknown };
  } catch {
    return fail();
  }
  if (typeof payload.p !== "string" || !payload.p) return fail();
  if (typeof payload.u !== "string" || !payload.u) return fail();

  const expected = Buffer.from(sign(payload.p, userId));
  const provided = Buffer.from(token.slice(dot + 1));
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return fail();
  }

  return { url: payload.u, publicId: payload.p, token };
}
