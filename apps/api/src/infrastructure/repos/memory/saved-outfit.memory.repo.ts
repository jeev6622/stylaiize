import { randomUUID } from "node:crypto";
import type { OutfitItem, OutfitScores, SavedOutfit } from "@stylaiize/shared";
import type {
  CreateSavedOutfitInput,
  SavedOutfitRepository,
} from "@/domain/ports/repositories";
import { NotFoundError } from "@/utils/errors";

/**
 * In-memory saved-outfit repository for demo mode (no MongoDB configured).
 * Data is intentionally not persisted across restarts.
 */
export class InMemorySavedOutfitRepository implements SavedOutfitRepository {
  private readonly outfits = new Map<string, SavedOutfit>();

  async create(input: CreateSavedOutfitInput): Promise<SavedOutfit> {
    const now = new Date().toISOString();
    const outfit: SavedOutfit = {
      id: randomUUID(),
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
      createdAt: now,
      updatedAt: now,
    };
    this.outfits.set(outfit.id, outfit);
    return structuredClone(outfit);
  }

  async findById(id: string): Promise<SavedOutfit | null> {
    const o = this.outfits.get(id);
    return o ? structuredClone(o) : null;
  }

  async findByUserId(userId: string): Promise<SavedOutfit[]> {
    return Array.from(this.outfits.values())
      .filter((o) => o.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((o) => structuredClone(o));
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        SavedOutfit,
        "name" | "category" | "occasion" | "style" | "colors" | "budget" | "items" | "scores" | "totalCost" | "imageUrl" | "explanation" | "grooming"
      >
    >,
  ): Promise<SavedOutfit | null> {
    const existing = this.outfits.get(id);
    if (!existing) throw new NotFoundError("Outfit not found.");
    const updated: SavedOutfit = {
      ...existing,
      ...patch,
      items: patch.items ? (structuredClone(patch.items) as OutfitItem[]) : existing.items,
      scores: patch.scores ? (structuredClone(patch.scores) as OutfitScores) : existing.scores,
      colors: patch.colors ?? existing.colors,
      updatedAt: new Date().toISOString(),
    };
    this.outfits.set(id, updated);
    return structuredClone(updated);
  }

  async delete(id: string): Promise<void> {
    this.outfits.delete(id);
  }

  async countByUserId(userId: string): Promise<number> {
    return Array.from(this.outfits.values()).filter((o) => o.userId === userId).length;
  }
}
