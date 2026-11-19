import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import type { CompleteOutfitImageItemInput, ShopAudience } from "@stylaiize/shared";
import { BUILD_LOOK_AUDIENCES } from "@stylaiize/shared";
import { OutfitImageProviderError } from "./errors";
import { downloadSecureImage, ImageFetchError } from "./secure-image-fetch";
import type {
  OutfitImageGeneration,
  OutfitImageGenerationRequest,
  OutfitImageProviderPort,
} from "./outfit-image.interface";

export const COLLAGE_IMAGE_WIDTH = 1200;
export const COLLAGE_IMAGE_HEIGHT = 900;
export const OUTFIT_COLLAGE_LABEL = "Outfit preview";
export const OUTFIT_COLLAGE_LICENSE =
  "Layout generated locally from the product images supplied by the verified catalog.";

export type CollageSlot = "top" | "outerwear" | "bottom" | "footwear" | "accessory" | "other";

const SLOT_ORDER: CollageSlot[] = [
  "top",
  "outerwear",
  "bottom",
  "footwear",
  "accessory",
  "other",
];

const SLOT_LABELS: Record<CollageSlot, string> = {
  top: "Top",
  outerwear: "Outerwear",
  bottom: "Bottom",
  footwear: "Footwear",
  accessory: "Accessories",
  other: "Item",
};

export interface CollageOutfitImageProviderConfig {
  cacheDir: string;
  publicBaseUrl: string;
  maxDownloadBytes: number;
  downloadTimeoutMs: number;
  maxSourceDimension: number;
}

interface CollagePiece {
  slot: CollageSlot;
  productId: string;
  imageUrl: string;
  label: string;
  index: number;
}

export function mapCategoryToCollageSlot(category: string): CollageSlot {
  const value = category.toLowerCase().replace(/[\s_-]+/g, "");
  if (/(blazer|jacket|coat|outerwear|overshirt)/.test(value)) return "outerwear";
  if (/(shirt|tshirt|tee|blouse|top|upperwear|kurta|polo)/.test(value)) return "top";
  if (/(trouser|pant|jean|skirt|short|lowerwear|bottom|legging)/.test(value)) return "bottom";
  if (/(shoe|footwear|sneaker|oxford|loafer|heel|sandal|boot)/.test(value)) return "footwear";
  if (/(accessor|watch|belt|jewel|earring|necklace|bag|scarf)/.test(value)) return "accessory";
  return "other";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cacheKey(audience: ShopAudience, pieces: CollagePiece[]): string {
  const payload = pieces.map(({ slot, productId, imageUrl }) => ({
    slot,
    productId,
    imageUrl,
  }));
  return createHash("sha256")
    .update(JSON.stringify({ audience, version: 1, pieces: payload }))
    .digest("hex");
}

function collectPieces(items: CompleteOutfitImageItemInput[]): CollagePiece[] {
  const pieces: CollagePiece[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const imageUrl = item.imageUrl?.trim();
    if (!imageUrl) continue;
    pieces.push({
      slot: mapCategoryToCollageSlot(item.category),
      productId: item.productId?.trim() || item.id,
      imageUrl,
      label: item.name,
      index,
    });
  }
  pieces.sort(
    (a, b) =>
      SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || a.index - b.index,
  );
  return pieces.slice(0, 6);
}

async function renderTile(viewport: { width: number; height: number }): Promise<Buffer> {
  return sharp({
    create: {
      width: viewport.width,
      height: viewport.height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(
          Buffer.from(
            `<svg width="${viewport.width}" height="${viewport.height}"><rect x="0.5" y="0.5" width="${viewport.width - 1}" height="${viewport.height - 1}" fill="#ffffff" stroke="#d8dee9" stroke-width="1"/></svg>`,
          ),
        )
          .png()
          .toBuffer(),
        top: 0,
        left: 0,
      },
    ])
    .webp()
    .toBuffer();
}

async function renderLabel(text: string, width: number): Promise<Buffer> {
  return sharp(
    Buffer.from(
      `<svg width="${width}" height="34"><rect width="${width}" height="34" fill="#f8fafc"/><text x="12" y="23" font-family="Arial,sans-serif" font-size="16" fill="#0f172a">${escapeXml(
        text.slice(0, 42),
      )}</text></svg>`,
    ),
  )
    .png()
    .toBuffer();
}

async function composeCollage(pieces: CollagePiece[], config: CollageOutfitImageProviderConfig) {
  const columns = 3;
  const gap = 24;
  const margin = 24;
  const headerHeight = 64;
  const cellWidth = Math.floor((COLLAGE_IMAGE_WIDTH - margin * 2 - gap * (columns - 1)) / columns);
  const cellHeight = Math.floor(
    (COLLAGE_IMAGE_HEIGHT - margin * 2 - headerHeight - gap) / 2,
  );
  const imageAreaHeight = cellHeight - 34;

  const base = await sharp({
    create: {
      width: COLLAGE_IMAGE_WIDTH,
      height: COLLAGE_IMAGE_HEIGHT,
      channels: 4,
      background: { r: 248, g: 250, b: 252, alpha: 1 },
    },
  })
    .composite([
      {
        input: await renderLabel(OUTFIT_COLLAGE_LABEL, COLLAGE_IMAGE_WIDTH - margin * 2),
        top: 18,
        left: margin,
      },
    ])
    .png()
    .toBuffer();

  const layers: OverlayOptions[] = [];
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    const tile = await renderTile({ width: cellWidth, height: cellHeight });
    const top = margin + headerHeight + Math.floor(index / columns) * (cellHeight + gap);
    const left = margin + (index % columns) * (cellWidth + gap);
    layers.push({ input: tile, top, left });

    layers.push({
      input: await renderLabel(SLOT_LABELS[piece.slot], cellWidth),
      top: top + imageAreaHeight,
      left,
    });

    try {
      const downloaded = await downloadSecureImage(piece.imageUrl, {
        maxBytes: config.maxDownloadBytes,
        timeoutMs: config.downloadTimeoutMs,
      });
      const metadata = await sharp(downloaded.buffer, {
        limitInputPixels: config.maxSourceDimension * config.maxSourceDimension * 4,
      }).metadata();
      const source = sharp(downloaded.buffer, {
        limitInputPixels: config.maxSourceDimension * config.maxSourceDimension * 4,
      }).rotate();
      if (
        metadata.width &&
        metadata.height &&
        Math.max(metadata.width, metadata.height) > config.maxSourceDimension
      ) {
        source.resize({
          width: config.maxSourceDimension,
          height: config.maxSourceDimension,
          fit: "inside",
          withoutEnlargement: true,
        });
      }
      const prepared = await source
        .resize({
          width: cellWidth - 20,
          height: imageAreaHeight - 20,
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();
      layers.push({ input: prepared, top: top + 10, left: left + 10 });
    } catch (err) {
      if (err instanceof ImageFetchError || err instanceof OutfitImageProviderError) {
        continue;
      }
      if (err instanceof Error) continue;
    }
  }

  const output = await sharp(base).composite(layers).webp({ quality: 88 }).toBuffer();
  return output;
}

export class CollageOutfitImageProvider implements OutfitImageProviderPort {
  readonly id = "collage_local";
  readonly isConfigured = true;
  readonly supportedAudiences = BUILD_LOOK_AUDIENCES;
  private readonly config: CollageOutfitImageProviderConfig;

  constructor(config: CollageOutfitImageProviderConfig) {
    this.config = config;
  }

  async generate(request: OutfitImageGenerationRequest): Promise<OutfitImageGeneration> {
    if (!this.supportedAudiences.includes(request.audience)) {
      throw new OutfitImageProviderError(
        this.id,
        `audience ${request.audience} is not supported by the collage provider`,
      );
    }

    const pieces = collectPieces(request.items);
    if (pieces.length === 0) {
      throw new OutfitImageProviderError(
        this.id,
        "no valid verified product images were provided for this outfit",
      );
    }

    const key = cacheKey(request.audience, pieces);
    const file = path.join(this.config.cacheDir, `${key}.webp`);
    try {
      await readFile(file);
    } catch {
      const output = await composeCollage(pieces, this.config);
      await mkdir(this.config.cacheDir, { recursive: true });
      await writeFile(file, output);
    }

    const publicBase = this.config.publicBaseUrl.replace(/\/$/, "");
    return {
      imageUrl: `${publicBase}/generated/outfit-images/${key}.webp`,
      provider: this.id,
      license: OUTFIT_COLLAGE_LICENSE,
      label: OUTFIT_COLLAGE_LABEL,
      matchBasis: "verified_products",
      mimeType: "image/webp",
      width: COLLAGE_IMAGE_WIDTH,
      height: COLLAGE_IMAGE_HEIGHT,
    };
  }
}
