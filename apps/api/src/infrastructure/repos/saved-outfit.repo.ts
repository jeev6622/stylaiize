import { getDatabaseStatus } from "@/config/mongodb";
import type { SavedOutfit } from "@stylaiize/shared";
import {
  SavedOutfitModel,
  toSavedOutfit,
} from "@/infrastructure/db/models/saved-outfit.model";
import type {
  CreateSavedOutfitInput,
  SavedOutfitRepository,
} from "@/domain/ports/repositories";

/**
 * Mongoose-backed saved-outfit repository.
 */
export class MongoSavedOutfitRepository implements SavedOutfitRepository {
  async create(input: CreateSavedOutfitInput): Promise<SavedOutfit> {
    const doc = await SavedOutfitModel.create({
      userId: input.userId,
      name: input.name,
      category: input.category ?? "casual",
      audience: input.audience ?? "all",
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
    return toSavedOutfit(doc);
  }

  async findById(id: string): Promise<SavedOutfit | null> {
    const doc = await SavedOutfitModel.findById(id);
    return doc ? toSavedOutfit(doc) : null;
  }

  async findByUserId(userId: string): Promise<SavedOutfit[]> {
    const docs = await SavedOutfitModel.find({ userId }).sort({ createdAt: -1 });
    return docs.map(toSavedOutfit);
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        SavedOutfit,
        "name" | "category" | "audience" | "occasion" | "style" | "colors" | "budget" | "items" | "scores" | "totalCost" |
        "imageUrl" | "explanation" | "grooming"
      >
    >,
  ): Promise<SavedOutfit | null> {
    const doc = await SavedOutfitModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true },
    );
    return doc ? toSavedOutfit(doc) : null;
  }

  async delete(id: string): Promise<void> {
    await SavedOutfitModel.findByIdAndDelete(id);
  }

  async countByUserId(userId: string): Promise<number> {
    return SavedOutfitModel.countDocuments({ userId });
  }
}

/** Returns the appropriate saved-outfit repository for the current database state. */
export function savedOutfitRepository(): SavedOutfitRepository {
  const db = getDatabaseStatus();
  if (!db.demoMode) return mongoSavedOutfitRepository;
  return demoSavedOutfitRepository ?? mongoSavedOutfitRepository;
}

let demoSavedOutfitRepository: SavedOutfitRepository | null = null;

export function registerDemoSavedOutfitRepository(
  repo: SavedOutfitRepository,
): void {
  demoSavedOutfitRepository = repo;
}

const mongoSavedOutfitRepository = new MongoSavedOutfitRepository();
