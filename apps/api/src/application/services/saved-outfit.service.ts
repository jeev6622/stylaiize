import type {
  GroomingPlan,
  Outfit,
  SavedOutfit,
  SavedOutfitSource,
} from "@stylaiize/shared";
import {
  savedOutfitRepository,
} from "@/infrastructure/repos/saved-outfit.repo";
import { NotFoundError } from "@/utils/errors";
import * as memoryService from "./memory.service";
import * as recommendService from "./recommend.service";
import * as wardrobeService from "./wardrobe.service";

/** Outfit categories are a subset of event categories; map the rest explicitly. */
const EVENT_CATEGORY_BY_OUTFIT: Record<SavedOutfit["category"], string> = {
  casual: "casual_outing",
  smart_casual: "dinner",
  formal: "wedding",
  business: "office_meeting",
  party: "birthday_party",
  ethnic: "religious_ceremony",
  beach: "beach_trip",
  sport: "sports_match",
  travel: "travel",
};

export interface CreateSavedOutfitInput {
  userId: string;
  name: string;
  category: SavedOutfit["category"];
  occasion?: string | null;
  style?: string | null;
  colors?: string[];
  budget?: number | null;
  items: SavedOutfit["items"];
  scores?: SavedOutfit["scores"];
  totalCost?: number | null;
  imageUrl?: string | null;
  explanation?: string | null;
  grooming?: GroomingPlan | null;
  source?: SavedOutfitSource;
}

export interface UpdateSavedOutfitInput {
  name?: string;
  category?: SavedOutfit["category"];
  occasion?: string | null;
  style?: string | null;
  colors?: string[];
  budget?: number | null;
  items?: SavedOutfit["items"];
  scores?: SavedOutfit["scores"];
  totalCost?: number | null;
  imageUrl?: string | null;
  explanation?: string | null;
  grooming?: GroomingPlan | null;
}

export async function listSavedOutfits(userId: string): Promise<SavedOutfit[]> {
  return savedOutfitRepository().findByUserId(userId);
}

export async function getSavedOutfit(
  userId: string,
  id: string,
): Promise<SavedOutfit> {
  const repo = savedOutfitRepository();
  const outfit = await repo.findById(id);
  if (!outfit || outfit.userId !== userId) {
    throw new NotFoundError("Outfit not found.");
  }
  return outfit;
}

export async function createSavedOutfit(
  input: CreateSavedOutfitInput,
): Promise<SavedOutfit> {
  const repo = savedOutfitRepository();
  const outfit = await repo.create({
    userId: input.userId,
    name: input.name,
    category: input.category,
    occasion: input.occasion ?? null,
    style: input.style ?? null,
    colors: input.colors ?? [],
    budget: input.budget ?? null,
    items: input.items,
    scores: input.scores ?? null,
    totalCost: input.totalCost ?? null,
    imageUrl: input.imageUrl ?? null,
    explanation: input.explanation ?? null,
    grooming: input.grooming ?? null,
    source: input.source ?? "manual",
  });
  await updateFashionMemoryFromOutfit(outfit);
  return outfit;
}

export async function updateSavedOutfit(
  userId: string,
  id: string,
  patch: UpdateSavedOutfitInput,
): Promise<SavedOutfit> {
  const repo = savedOutfitRepository();
  const existing = await repo.findById(id);
  if (!existing || existing.userId !== userId) {
    throw new NotFoundError("Outfit not found.");
  }
  const updated = await repo.update(id, patch);
  if (!updated) {
    throw new NotFoundError("Outfit not found.");
  }
  return updated;
}

export async function deleteSavedOutfit(
  userId: string,
  id: string,
): Promise<void> {
  const repo = savedOutfitRepository();
  const existing = await repo.findById(id);
  if (!existing || existing.userId !== userId) {
    throw new NotFoundError("Outfit not found.");
  }
  await repo.delete(id);
}

/**
 * Re-runs the AI recommendation using the saved outfit's occasion/style and
 * replaces that outfit's content in place (keeps id, name, category, occasion).
 *
 * Used by the library "Regenerate" action so a saved look can get a fresh
 * variant without losing its place in the collection.
 */
export async function regenerateSavedOutfit(
  userId: string,
  id: string,
): Promise<SavedOutfit> {
  const repo = savedOutfitRepository();
  const existing = await repo.findById(id);
  if (!existing || existing.userId !== userId) {
    throw new NotFoundError("Outfit not found.");
  }

  const eventName = existing.occasion?.trim() || existing.name;
  const eventCategory = EVENT_CATEGORY_BY_OUTFIT[existing.category] as
    | "casual_outing"
    | "dinner"
    | "wedding"
    | "office_meeting"
    | "birthday_party"
    | "religious_ceremony"
    | "beach_trip"
    | "sports_match"
    | "travel";

  const recommendations = await recommendService.getRecommendations({
    event: {
      name: eventName,
      date: null,
      time: null,
      venue: null,
      dressCode: null,
      theme: existing.style?.trim() || null,
      weather: null,
      indoorOutdoor: "unknown",
      category: eventCategory,
      source: "saved_outfit",
      notes: null,
    },
    wardrobeItems: await getWardrobeItems(userId),
    fashionMemory: await getFashionMemory(userId),
  });

  const best = recommendations.outfits[0];
  if (!best) {
    throw new Error("Could not regenerate this outfit. Please try again.");
  }

  const updated = await repo.update(id, {
    items: best.items,
    scores: best.scores,
    totalCost: best.totalCost,
    colors: [...new Set(best.items.map((i) => i.color))],
    explanation: best.explanation,
    // Keep the existing image (a try-on snapshot) if there was one.
    imageUrl: existing.imageUrl,
  });
  if (!updated) {
    throw new NotFoundError("Outfit not found.");
  }
  return updated;
}

async function getWardrobeItems(userId: string) {
  try {
    return await wardrobeService.getItems(userId);
  } catch {
    return undefined;
  }
}

async function getFashionMemory(userId: string) {
  try {
    const memory = await memoryService.getMemory(userId);
    const isEmpty =
      memory.previousOutfits.length === 0 &&
      memory.attendedEvents.length === 0 &&
      memory.favoriteColors.length === 0 &&
      memory.favoriteBrands.length === 0 &&
      !memory.budget &&
      Object.keys(memory.sizes).length === 0 &&
      memory.shoppingHistory.length === 0 &&
      memory.wardrobeOwned.length === 0 &&
      !memory.styleProfile;
    return isEmpty ? null : memory;
  } catch {
    return null;
  }
}

/** Saves an AI-generated outfit (from the recommend flow) for the current user. */
export async function saveAiOutfit(
  userId: string,
  outfit: Outfit,
  opts?: { occasion?: string | null; style?: string | null },
): Promise<SavedOutfit> {
  const repo = savedOutfitRepository();
  const saved = await repo.create({
    userId,
    name: outfit.name,
    category: outfit.category,
    occasion: opts?.occasion ?? null,
    style: opts?.style ?? null,
    colors: [...new Set(outfit.items.map((i) => i.color))],
    budget: outfit.totalCost ?? null,
    items: outfit.items,
    scores: outfit.scores,
    totalCost: outfit.totalCost ?? null,
    imageUrl: outfit.tryOnUrl ?? null,
    explanation: outfit.explanation,
    source: "ai",
  });
  await updateFashionMemoryFromOutfit(saved);
  return saved;
}

/**
 * Persists a summary of every saved outfit into the user's fashion memory so
 * the AI can reuse colors, brands and styles across future recommendations.
 */
async function updateFashionMemoryFromOutfit(outfit: SavedOutfit): Promise<void> {
  try {
    const memory = await memoryService.getMemory(outfit.userId);
    const brands = memory.favoriteBrands.concat(
      outfit.items.map((i) => i.brand).filter((b): b is string => Boolean(b)),
    );
    await memoryService.updateMemory(outfit.userId, {
      favoriteColors: [...new Set(memory.favoriteColors.concat(outfit.colors))].slice(0, 200),
      favoriteBrands: [...new Set(brands)].slice(0, 500),
      previousOutfits: memory.previousOutfits.concat([
        {
          outfitId: outfit.id,
          eventId: outfit.occasion ?? "unspecified",
          wornAt: new Date().toISOString(),
        },
      ]),
    });
  } catch {
    // Memory enrichment is best-effort and never blocks saving an outfit.
  }
}

export async function countSavedOutfits(userId: string): Promise<number> {
  return savedOutfitRepository().countByUserId(userId);
}
