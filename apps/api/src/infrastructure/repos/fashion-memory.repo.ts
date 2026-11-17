import type { FashionMemoryRepository, FashionMemoryPatch } from "@/domain/ports/repositories";
import type { FashionMemory } from "@stylaiize/shared";
import { getDatabaseStatus } from "@/config/mongodb";
import {
  FashionMemoryModel,
  toFashionMemory,
  type FashionMemoryDocument,
} from "@/infrastructure/db/models/fashion-memory.model";

class MongoFashionMemoryRepository implements FashionMemoryRepository {
  async findByUserId(userId: string): Promise<FashionMemory | null> {
    const doc = await FashionMemoryModel.findOne({ userId });
    return doc ? toFashionMemory(doc) : null;
  }

  async upsert(userId: string, patch: FashionMemoryPatch): Promise<FashionMemory> {
    const updated = await FashionMemoryModel.findOneAndUpdate(
      { userId },
      { $set: patch },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return toFashionMemory(updated as FashionMemoryDocument & { _id: unknown });
  }
}

/** Returns the appropriate fashion memory repository for the current database state. */
export function fashionMemoryRepository(): FashionMemoryRepository {
  return getDatabaseStatus().demoMode
    ? demoFashionMemoryRepository ?? mongoFashionMemoryRepository
    : mongoFashionMemoryRepository;
}

let demoFashionMemoryRepository: FashionMemoryRepository | null = null;

export function registerDemoFashionMemoryRepository(repo: FashionMemoryRepository): void {
  demoFashionMemoryRepository = repo;
}

const mongoFashionMemoryRepository = new MongoFashionMemoryRepository();