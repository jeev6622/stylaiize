import { wardrobeRepository } from "@/infrastructure/repos/wardrobe.repo";
import type { CreateWardrobeItemInput } from "@/domain/ports/repositories";
import { WARDROBE_CATEGORIES } from "@stylaiize/shared";
import type { WardrobeItem, WardrobeCategory, Wardrobe } from "@stylaiize/shared";
import { z } from "zod";
import { NotFoundError } from "@/utils/errors";
import { aiService } from "@/application/services/ai.service";
import {
  saveImage,
  deleteImage,
  createUploadToken,
  resolveUploadToken,
  type StoredImage,
} from "@/application/services/storage.service";

export type WardrobeSort = "newest" | "oldest" | "name" | "mostWorn" | "leastWorn" | "price";

export interface ListWardrobeQuery {
  category?: WardrobeCategory;
  search?: string;
  sort?: WardrobeSort;
}

export interface CategorizeResult {
  name: string;
  category: WardrobeCategory;
  color: string;
  brand: string | null;
  tags: string[];
  imageUrl: string | null;
  imageUploadToken: string | null;
  confidence: number;
}

/** Fields a caller is allowed to change on an existing item. */
export interface WardrobePatch {
  name?: string;
  category?: WardrobeCategory;
  color?: string;
  imageUrl?: string | null;
  /** Signed token from `POST /wardrobe/upload`; takes precedence over `imageUrl`. */
  imageUploadToken?: string | null;
  brand?: string | null;
  purchasedPrice?: number | null;
  tags?: string[];
}

export async function createItem(
  userId: string,
  input: Omit<CreateWardrobeItemInput, "userId" | "imagePublicId"> & {
    imageUploadToken?: string | null;
  },
): Promise<WardrobeItem> {
  const { imageUploadToken, ...fields } = input;
  const image = imageUploadToken
    ? resolveUploadToken(imageUploadToken, userId)
    : null;

  return wardrobeRepository().create({
    ...fields,
    userId,
    imageUrl: image ? image.url : (fields.imageUrl ?? null),
    imagePublicId: image ? image.publicId : null,
  });
}

export async function getItems(userId: string): Promise<WardrobeItem[]> {
  return wardrobeRepository().findByUserId(userId);
}

export async function getItemsByCategory(
  userId: string,
  category: WardrobeCategory,
): Promise<WardrobeItem[]> {
  return wardrobeRepository().findByUserIdAndCategory(userId, category);
}

export async function getItem(userId: string, itemId: string): Promise<WardrobeItem> {
  const item = await wardrobeRepository().findById(itemId);
  if (!item || item.userId !== userId) throw new NotFoundError("Item not found.");
  return item;
}

/**
 * Lists the wardrobe with optional search/sort applied.
 *
 * Filtering happens in the service (not the repository) so Mongo and the
 * in-memory demo repository return identical results.
 */
export async function listItems(
  userId: string,
  query: ListWardrobeQuery = {},
): Promise<WardrobeItem[]> {
  const base = query.category
    ? await getItemsByCategory(userId, query.category)
    : await getItems(userId);

  return sortItems(filterItems(base, query.search), query.sort);
}

function filterItems(items: WardrobeItem[], search?: string): WardrobeItem[] {
  const term = search?.trim().toLowerCase();
  if (!term) return items;

  return items.filter((item) =>
    [item.name, item.color, item.brand, item.category, ...item.tags]
      .filter((v): v is string => Boolean(v))
      .some((value) => value.toLowerCase().includes(term)),
  );
}

function sortItems(items: WardrobeItem[], sort?: WardrobeSort): WardrobeItem[] {
  const sorted = [...items];
  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "mostWorn":
      return sorted.sort((a, b) => b.timesWorn - a.timesWorn);
    case "leastWorn":
      return sorted.sort((a, b) => a.timesWorn - b.timesWorn);
    case "price":
      return sorted.sort(
        (a, b) => (b.purchasedPrice ?? 0) - (a.purchasedPrice ?? 0),
      );
    case "newest":
    default:
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export async function updateItem(
  userId: string,
  itemId: string,
  patch: WardrobePatch,
): Promise<WardrobeItem> {
  const existing = await getItem(userId, itemId);
  const { imageUploadToken, ...fields } = patch;

  const nextImage: StoredImage | null = imageUploadToken
    ? resolveUploadToken(imageUploadToken, userId)
    : null;

  // A token identifies the new asset; a null token means "keep the current
  // image" (the client omits the field when the user did not change it).
  const repoPatch: Partial<WardrobeItem> & {
    imagePublicId?: string | null;
  } = { ...fields };
  if (nextImage) {
    repoPatch.imageUrl = nextImage.url;
    repoPatch.imagePublicId = nextImage.publicId;
  }

  const updated = await wardrobeRepository().update(itemId, repoPatch);
  if (!updated) throw new NotFoundError("Item not found.");

  // Only a replaced image makes the previous asset unreachable.
  if (
    nextImage &&
    existing.imagePublicId &&
    existing.imagePublicId !== nextImage.publicId
  ) {
    await deleteImage(existing.imagePublicId);
  }
  return updated;
}

export async function deleteItem(userId: string, itemId: string): Promise<void> {
  const existing = await getItem(userId, itemId);
  // Delete the record first: if asset cleanup fails we only leak storage,
  // whereas the reverse order could leave a dangling item pointing at nothing.
  await wardrobeRepository().delete(itemId);
  if (existing.imagePublicId) {
    await deleteImage(existing.imagePublicId);
  }
}

/**
 * Records that an item was worn today.
 *
 * This is the only writer of `timesWorn`; cost-per-wear and the sustainability
 * metrics depend on it, so it is called from the calendar/try-on flows too.
 * Re-wearing on the same day does not double-count.
 */
export async function markWorn(userId: string, itemId: string): Promise<WardrobeItem> {
  const existing = await getItem(userId, itemId);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const alreadyWornToday =
    existing.lastWornAt?.slice(0, 10) === today && existing.timesWorn > 0;

  if (alreadyWornToday) {
    return existing;
  }

  const updated = await wardrobeRepository().incrementWear(itemId, now.toISOString());
  if (!updated) throw new NotFoundError("Item not found.");
  return updated;
}

/** Stores an uploaded image and returns its public URL plus a claim token. */
export async function attachImage(
  userId: string,
  input: { buffer: Buffer; mimeType: string; filename: string },
): Promise<{ imageUrl: string; imageUploadToken: string }> {
  const result = await saveImage({ ...input, folder: "wardrobe" });
  return {
    imageUrl: result.url,
    imageUploadToken: createUploadToken(result.publicId, result.url, userId),
  };
}

/**
 * Asks the AI to identify a garment from a photo and returns the fields the
 * user would otherwise have to type in.
 *
 * The photo is uploaded first so the user can see it in the draft, so a failed
 * AI call has to remove the asset it just created.
 */
const WARDROBE_CATEGORY_ENUM = [...WARDROBE_CATEGORIES] as [
  WardrobeCategory,
  ...WardrobeCategory[],
];

const categorizeSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    category: z.enum(WARDROBE_CATEGORY_ENUM),
    color: z.string().trim().min(1).max(80),
    brand: z.string().trim().min(1).max(120).nullable().default(null),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    confidence: z.number().finite().min(0).max(100).default(0),
  })
  .strict();

export async function categorizeImage(
  userId: string,
  input: { buffer: Buffer; mimeType: string; filename: string },
): Promise<CategorizeResult> {
  const { imageUrl, imageUploadToken } = await attachImage(userId, input);

  let raw: z.infer<typeof categorizeSchema>;
  try {
    raw = await aiService.generateJson(
      {
        task: "analyze_photo",
        instruction:
          "Look at this photo of a single garment and identify it. Return the product name, " +
          "the most specific wardrobe category, its dominant color as a common color name, the " +
          "brand if the label is legible (otherwise null), and up to 5 useful style tags.",
        context: `Valid categories: ${WARDROBE_CATEGORY_HINT}.`,
        outputSchema: {
          name: "string, the garment's product name",
          category: `one of ${WARDROBE_CATEGORY_HINT}`,
          color: "string, dominant colour name",
          brand: "string|null",
          tags: ["string"],
          confidence: "number 0-100",
        },
        images: [{ mimeType: input.mimeType, data: input.buffer.toString("base64") }],
      },
      categorizeSchema,
    );
  } catch (err) {
    // The item was never created, so the image would be unreferenced.
    await deleteImage(resolveUploadToken(imageUploadToken, userId).publicId);
    throw err;
  }

  const category = toWardrobeCategory(raw.category);

  return {
    name: (raw.name ?? "New item").trim() || "New item",
    category,
    color: (raw.color ?? "Unknown").trim() || "Unknown",
    brand: raw.brand?.trim() || null,
    tags: (raw.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 10),
    imageUrl,
    imageUploadToken,
    confidence: clamp(raw.confidence ?? 0),
  };
}

const WARDROBE_CATEGORY_HINT = [
  "tops",
  "bottoms",
  "outerwear",
  "dresses",
  "footwear",
  "accessories",
  "bags",
  "ethnic",
  "sportswear",
].join(" | ");

function toWardrobeCategory(value?: string): WardrobeCategory {
  const allowed: WardrobeCategory[] = [
    "tops",
    "bottoms",
    "outerwear",
    "dresses",
    "footwear",
    "accessories",
    "bags",
    "ethnic",
    "sportswear",
  ];
  const match = allowed.find((c) => c === value?.trim().toLowerCase());
  // An unrecognised category would be rejected by the create schema, so the
  // user would get a validation error instead of a usable draft.
  return match ?? "accessories";
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export async function getWardrobeSummary(userId: string): Promise<Wardrobe> {
  const items = await wardrobeRepository().findByUserId(userId);
  const itemsUsed = items.filter((i) => i.timesWorn > 0).length;

  // Each wear beyond the first avoided a purchase, so the saving is the item's
  // price multiplied by the number of re-wears.
  const moneySaved = items.reduce(
    (sum, i) => (i.purchasedPrice ? sum + i.purchasedPrice * Math.max(0, i.timesWorn - 1) : sum),
    0,
  );

  return {
    items,
    totalItems: items.length,
    itemsUsed,
    wardrobeUtilization:
      items.length > 0 ? Math.round((itemsUsed / items.length) * 100) : 0,
    moneySaved: Math.round(moneySaved),
  };
}
