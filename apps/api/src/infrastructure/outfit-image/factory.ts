import path from "node:path";
import { env } from "@/config/env";
import { isOutfitImageConfigured } from "@/config/features";
import { CollageOutfitImageProvider } from "./collage-outfit-image.provider";
import { HttpOutfitImageProvider } from "./http-outfit-image.provider";
import type { OutfitImageProviderPort } from "./outfit-image.interface";

let cached: OutfitImageProviderPort | null = null;

export function resolveCollageCacheDir(): string {
  const configured = env.OUTFIT_IMAGE_CACHE_DIR.trim();
  return path.resolve(process.cwd(), configured || ".cache/outfit-images");
}

export function resolveOutfitImageProvider(): OutfitImageProviderPort {
  if (cached) return cached;

  if (env.OUTFIT_IMAGE_PROVIDER === "http" && isOutfitImageConfigured()) {
    cached = new HttpOutfitImageProvider({
      id: "http_json",
      endpoint: env.OUTFIT_IMAGE_API_URL,
      apiKey: env.OUTFIT_IMAGE_API_KEY,
      license: env.OUTFIT_IMAGE_LICENSE,
      timeoutMs: env.OUTFIT_IMAGE_TIMEOUT_MS,
    });
    return cached;
  }

  cached = new CollageOutfitImageProvider({
    cacheDir: resolveCollageCacheDir(),
    publicBaseUrl: env.API_PUBLIC_URL || "http://localhost:4000",
    maxDownloadBytes: env.OUTFIT_IMAGE_MAX_DOWNLOAD_BYTES,
    downloadTimeoutMs: env.OUTFIT_IMAGE_DOWNLOAD_TIMEOUT_MS,
    maxSourceDimension: env.OUTFIT_IMAGE_MAX_SOURCE_DIMENSION,
  });
  return cached;
}

export function resetOutfitImageProvider(): void {
  cached = null;
}
