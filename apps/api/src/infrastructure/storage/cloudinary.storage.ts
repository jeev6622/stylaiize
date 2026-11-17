import { v2 as cloudinary } from "cloudinary";
import { env } from "@/config/env";
import { isCloudinaryConfigured } from "@/config/features";
import { AppError } from "@/utils/errors";
import type {
  StorageProviderPort,
  UploadInput,
  UploadResult,
} from "./storage.interface";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export class CloudinaryStorage implements StorageProviderPort {
  readonly provider = "cloudinary" as const;

  get isConfigured(): boolean {
    return isCloudinaryConfigured;
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    if (!this.isConfigured) {
      throw new AppError(503, "Cloudinary is not configured.", {
        code: "STORAGE_NOT_CONFIGURED",
      });
    }
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: input.folder ? `stylaiize/${input.folder}` : "stylaiize",
          resource_type: "auto",
          format: guessFormat(input.mimeType),
          transformation: [{ quality: "auto", fetch_format: "auto" }],
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error("Cloudinary upload failed"));
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            provider: this.provider,
          });
        },
      );
      stream.end(input.buffer);
    });
  }

  async delete(publicId: string): Promise<void> {
    if (!this.isConfigured) return;
    await cloudinary.uploader.destroy(publicId);
  }
}

function guessFormat(mimeType: string): string | undefined {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
  };
  return map[mimeType];
}
