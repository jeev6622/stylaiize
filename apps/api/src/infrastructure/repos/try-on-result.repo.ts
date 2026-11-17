import { getDatabaseStatus } from "@/config/mongodb";
import { isValidObjectId } from "mongoose";
import type {
  CreateTryOnResultInput,
  TryOnResultRepository,
} from "@/domain/ports/repositories";
import type { TryOnResultRecord } from "@stylaiize/shared";
import { TryOnResultModel, toTryOnResult } from "@/infrastructure/db/models/try-on-result.model";

/**
 * Mongoose-backed try-on result repository.
 * Used whenever MongoDB is connected; otherwise callers use the in-memory
 * demo repository.
 */
export class MongoTryOnResultRepository implements TryOnResultRepository {
  async create(input: CreateTryOnResultInput): Promise<TryOnResultRecord> {
    const doc = await TryOnResultModel.create({
      userId: input.userId,
      provider: input.provider,
      category: input.category ?? null,
      personImage: input.personImage ?? null,
      garmentImage: input.garmentImage ?? null,
      garmentLabel: input.garmentLabel ?? null,
      resultImage: input.resultImage ?? null,
      mimeType: input.mimeType ?? null,
      sourceUrl: input.sourceUrl ?? null,
      processingTimeMs: input.processingTimeMs ?? null,
    });
    return toTryOnResult(doc);
  }

  async findById(id: string): Promise<TryOnResultRecord | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await TryOnResultModel.findById(id);
    return doc ? toTryOnResult(doc) : null;
  }

  async findByUserId(userId: string): Promise<TryOnResultRecord[]> {
    const docs = await TryOnResultModel.find({ userId }).sort({ createdAt: -1 });
    return docs.map(toTryOnResult);
  }

  async delete(id: string): Promise<void> {
    if (!isValidObjectId(id)) return;
    await TryOnResultModel.findByIdAndDelete(id);
  }
}

let demoTryOnResultRepository: TryOnResultRepository | null = null;

export function registerDemoTryOnResultRepository(repo: TryOnResultRepository): void {
  demoTryOnResultRepository = repo;
}

const mongoTryOnResultRepository = new MongoTryOnResultRepository();

/** Returns the appropriate try-on result repository for the current database state. */
export function tryOnResultRepository(): TryOnResultRepository {
  const db = getDatabaseStatus();
  if (!db.demoMode) return mongoTryOnResultRepository;
  return demoTryOnResultRepository ?? mongoTryOnResultRepository;
}
