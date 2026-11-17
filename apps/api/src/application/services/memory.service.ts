import type { FashionMemory, StyleProfile } from "@stylaiize/shared";
import {
  fashionMemoryRepository,
} from "@/infrastructure/repos/fashion-memory.repo";
import type { FashionMemoryPatch } from "@/domain/ports/repositories";

const EMPTY_MEMORY: Omit<FashionMemory, "id" | "userId"> = {
  previousOutfits: [],
  attendedEvents: [],
  favoriteBrands: [],
  favoriteColors: [],
  budget: null,
  sizes: {},
  shoppingHistory: [],
  wardrobeOwned: [],
  styleProfile: null,
};

export async function getMemory(userId: string): Promise<FashionMemory> {
  const existing = await fashionMemoryRepository().findByUserId(userId);
  if (existing) return existing;
  // Seed an empty memory record so the UI always has something to read.
  return fashionMemoryRepository().upsert(userId, EMPTY_MEMORY);
}

export async function updateMemory(
  userId: string,
  patch: FashionMemoryPatch,
): Promise<FashionMemory> {
  return fashionMemoryRepository().upsert(userId, patch);
}

export async function recordOutfitWorn(
  userId: string,
  outfitId: string,
  eventId: string,
): Promise<FashionMemory> {
  const memory = await getMemory(userId);
  return updateMemory(userId, {
    previousOutfits: [
      ...memory.previousOutfits,
      { outfitId, eventId, wornAt: new Date().toISOString() },
    ],
  });
}

/**
 * Persist an explicitly reviewed style profile. The caller must enforce that
 * the profile was user-edited (opt-in save, never automatic).
 */
export async function saveStyleProfile(
  userId: string,
  styleProfile: StyleProfile,
): Promise<FashionMemory> {
  return updateMemory(userId, { styleProfile });
}