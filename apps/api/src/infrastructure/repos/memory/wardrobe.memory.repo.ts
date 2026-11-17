import { randomUUID } from "node:crypto";
import type { WardrobeItem, WardrobeCategory } from "@stylaiize/shared";
import type {
  WardrobeRepository,
  CreateWardrobeItemInput,
} from "@/domain/ports/repositories";

/**
 * In-memory wardrobe repository for demo mode (no MongoDB configured).
 * Data is intentionally not persisted across restarts.
 */
export class InMemoryWardrobeRepository implements WardrobeRepository {
  private readonly items = new Map<string, WardrobeItem>();

  async create(input: CreateWardrobeItemInput): Promise<WardrobeItem> {
    const now = new Date().toISOString();
    const item: WardrobeItem = {
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      category: input.category,
      color: input.color,
      imageUrl: input.imageUrl ?? null,
      imagePublicId: input.imagePublicId ?? null,
      brand: input.brand ?? null,
      purchasedPrice: input.purchasedPrice ?? null,
      timesWorn: 0,
      lastWornAt: null,
      costPerWear: null,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(item.id, structuredClone(item));
    return structuredClone(item);
  }

  async findById(id: string): Promise<WardrobeItem | null> {
    const item = this.items.get(id);
    return item ? structuredClone(item) : null;
  }

  async findByUserId(userId: string): Promise<WardrobeItem[]> {
    const results: WardrobeItem[] = [];
    for (const item of this.items.values()) {
      if (item.userId === userId) results.push(structuredClone(item));
    }
    return results.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async findByUserIdAndCategory(
    userId: string,
    category: WardrobeCategory,
  ): Promise<WardrobeItem[]> {
    const results: WardrobeItem[] = [];
    for (const item of this.items.values()) {
      if (item.userId === userId && item.category === category)
        results.push(structuredClone(item));
    }
    return results.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async countByUserId(userId: string): Promise<number> {
    let count = 0;
    for (const item of this.items.values()) {
      if (item.userId === userId) count++;
    }
    return count;
  }

  async countAll(): Promise<number> {
    return this.items.size;
  }

  async update(
    id: string,
    patch: Partial<Pick<WardrobeItem, "name" | "category" | "color" | "imageUrl" | "imagePublicId" | "brand" | "purchasedPrice" | "timesWorn" | "lastWornAt" | "tags">>,
  ): Promise<WardrobeItem | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated: WardrobeItem = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.items.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async incrementWear(id: string, wornAt: string): Promise<WardrobeItem | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    // Single-process repo, so a synchronous read-modify-write is already atomic.
    const timesWorn = existing.timesWorn + 1;
    const updated: WardrobeItem = {
      ...existing,
      timesWorn,
      lastWornAt: wornAt,
      costPerWear:
        existing.purchasedPrice !== null
          ? Math.round((existing.purchasedPrice / timesWorn) * 100) / 100
          : null,
      updatedAt: new Date().toISOString(),
    };
    this.items.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}
