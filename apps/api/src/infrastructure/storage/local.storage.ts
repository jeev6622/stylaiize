import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/config/env";
import { AppError } from "@/utils/errors";
import type {
  StorageProviderPort,
  UploadInput,
  UploadResult,
} from "./storage.interface";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
};

export class LocalStorage implements StorageProviderPort {
  readonly provider = "local" as const;
  readonly isConfigured = true;

  async upload(input: UploadInput): Promise<UploadResult> {
    const folder = input.folder ?? "general";
    const ext = EXT_BY_MIME[input.mimeType] ?? (path.extname(input.filename) || ".bin");
    const publicId = `stylaiize/${folder}/${randomUUID()}${ext}`;
    const absolute = path.join(UPLOAD_ROOT, folder, `${path.basename(publicId)}`);

    try {
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, input.buffer);
    } catch (err) {
      throw new AppError(500, "Failed to persist uploaded file locally.", {
        code: "STORAGE_WRITE_ERROR",
        cause: err,
      });
    }

    return {
      url: `${env.API_PUBLIC_URL.replace(/\/$/, "")}/uploads/${path.posix.join(folder, path.basename(publicId))}`,
      publicId,
      provider: this.provider,
    };
  }

  async delete(publicId: string): Promise<void> {
    const relative = publicId.replace(/^stylaiize\//, "");
    const absolute = path.resolve(UPLOAD_ROOT, relative);
    // Compare with a trailing separator so a sibling directory such as
    // `uploads-backup` cannot pass a naive prefix check.
    const rootWithSep = UPLOAD_ROOT.endsWith(path.sep) ? UPLOAD_ROOT : `${UPLOAD_ROOT}${path.sep}`;
    if (absolute === UPLOAD_ROOT || !absolute.startsWith(rootWithSep)) return;
    await rm(absolute, { force: true });
  }
}
