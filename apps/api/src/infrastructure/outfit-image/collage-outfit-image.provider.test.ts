import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./secure-image-fetch", () => ({
  ImageFetchError: class ImageFetchError extends Error {},
  downloadSecureImage: vi.fn(),
}));

import { downloadSecureImage } from "./secure-image-fetch";
import {
  CollageOutfitImageProvider,
  OUTFIT_COLLAGE_LABEL,
  COLLAGE_IMAGE_HEIGHT,
  COLLAGE_IMAGE_WIDTH,
  mapCategoryToCollageSlot,
} from "./collage-outfit-image.provider";
import { OutfitImageProviderError } from "./errors";

const mockedDownload = vi.mocked(downloadSecureImage);

async function tinyImage(color: { r: number; g: number; b: number }) {
  return sharp({
    create: { width: 32, height: 32, channels: 4, background: { ...color, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe("collage outfit image provider", () => {
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = await mkdtemp(path.join(os.tmpdir(), "stylaiize-collage-"));
    mockedDownload.mockReset();
  });

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  it("maps categories to logical flat-lay slots", () => {
    expect(mapCategoryToCollageSlot("Formal Shirts")).toBe("top");
    expect(mapCategoryToCollageSlot("blazers")).toBe("outerwear");
    expect(mapCategoryToCollageSlot("lowerwear")).toBe("bottom");
    expect(mapCategoryToCollageSlot("footwear")).toBe("footwear");
    expect(mapCategoryToCollageSlot("accessories")).toBe("accessory");
    expect(mapCategoryToCollageSlot("unknown")).toBe("other");
  });

  it("creates a non-empty preview with the expected dimensions", async () => {
    mockedDownload.mockResolvedValue({
      buffer: await tinyImage({ r: 30, g: 70, b: 120 }),
      contentType: "image/png",
      url: "https://images.example/product.png",
    });

    const provider = new CollageOutfitImageProvider({
      cacheDir,
      publicBaseUrl: "https://api.example",
      maxDownloadBytes: 8_388_608,
      downloadTimeoutMs: 10_000,
      maxSourceDimension: 2000,
    });

    const result = await provider.generate({
      prompt: "unused",
      audience: "men",
      eventName: "wedding",
      style: "formal",
      items: [
        {
          id: "item-1",
          name: "Shirt",
          category: "upperwear",
          color: "white",
          productId: "prod-1",
          imageUrl: "https://images.example/product.png",
        },
      ],
    });

    expect(result.label).toBe(OUTFIT_COLLAGE_LABEL);
    expect(result.matchBasis).toBe("verified_products");
    expect(result.mimeType).toBe("image/webp");
    expect(result.imageUrl).toMatch(/^https:\/\/api\.example\/generated\/outfit-images\/.+\.webp$/);

    const key = result.imageUrl.split("/").pop()?.replace(".webp", "") ?? "";
    const output = await readFile(path.join(cacheDir, `${key}.webp`));
    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(COLLAGE_IMAGE_WIDTH);
    expect(metadata.height).toBe(COLLAGE_IMAGE_HEIGHT);
  });

  it("reuses cached output for the same product IDs and image URLs", async () => {
    mockedDownload.mockResolvedValue({
      buffer: await tinyImage({ r: 30, g: 70, b: 120 }),
      contentType: "image/png",
      url: "https://images.example/product.png",
    });
    const provider = new CollageOutfitImageProvider({
      cacheDir,
      publicBaseUrl: "https://api.example",
      maxDownloadBytes: 8_388_608,
      downloadTimeoutMs: 10_000,
      maxSourceDimension: 2000,
    });
    const request = {
      prompt: "unused",
      audience: "men" as const,
      eventName: "wedding",
      style: "formal",
      items: [
        {
          id: "item-1",
          name: "Shirt",
          category: "upperwear",
          color: "white",
          productId: "prod-1",
          imageUrl: "https://images.example/product.png",
        },
      ],
    };

    const first = await provider.generate(request);
    await provider.generate(request);

    expect(mockedDownload).toHaveBeenCalledTimes(1);
    expect(first.imageUrl).toMatch(/\.webp$/);
  });

  it("fails clearly when no valid product images are available", async () => {
    const provider = new CollageOutfitImageProvider({
      cacheDir,
      publicBaseUrl: "https://api.example",
      maxDownloadBytes: 8_388_608,
      downloadTimeoutMs: 10_000,
      maxSourceDimension: 2000,
    });

    await expect(
      provider.generate({
        prompt: "unused",
        audience: "men",
        eventName: "wedding",
        style: "formal",
        items: [
          {
            id: "item-1",
            name: "Shirt",
            category: "upperwear",
            color: "white",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(OutfitImageProviderError);
  });
});
