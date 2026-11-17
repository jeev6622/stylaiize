import type { FashionMemory } from "@stylaiize/shared";
import type {
  FashionMemoryRepository,
  FashionMemoryPatch,
} from "@/domain/ports/repositories";

/**
 * In-memory fashion memory repository for demo mode (no MongoDB configured).
 * Data is intentionally not persisted across restarts.
 */
export class InMemoryFashionMemoryRepository implements FashionMemoryRepository {
  private readonly store = new Map<string, FashionMemory>();

  async findByUserId(userId: string): Promise<FashionMemory | null> {
    const mem = this.store.get(userId);
    return mem ? structuredClone(mem) : null;
  }

  async upsert(userId: string, patch: FashionMemoryPatch): Promise<FashionMemory> {
    const existing = this.store.get(userId);
    const next: FashionMemory = {
      id: existing?.id ?? userId,
      userId,
      previousOutfits: patch.previousOutfits ?? existing?.previousOutfits ?? [],
      attendedEvents: patch.attendedEvents ?? existing?.attendedEvents ?? [],
      favoriteBrands: patch.favoriteBrands ?? existing?.favoriteBrands ?? [],
      favoriteColors: patch.favoriteColors ?? existing?.favoriteColors ?? [],
      budget: patch.budget !== undefined ? patch.budget : (existing?.budget ?? null),
      sizes: patch.sizes ?? existing?.sizes ?? {},
      shoppingHistory: patch.shoppingHistory ?? existing?.shoppingHistory ?? [],
      wardrobeOwned: patch.wardrobeOwned ?? existing?.wardrobeOwned ?? [],
      styleProfile:
        patch.styleProfile !== undefined
          ? patch.styleProfile
          : (existing?.styleProfile ?? null),
    };
    this.store.set(userId, structuredClone(next));
    return structuredClone(next);
  }
}