import { randomUUID } from "node:crypto";
import type { TryOnResultRecord } from "@stylaiize/shared";
import {
  type CreateTryOnResultInput,
  type TryOnResultRepository,
} from "@/domain/ports/repositories";

/**
 * In-memory try-on result repository for demo mode (no MongoDB).
 * Images are stored as base64 and are not persisted across restarts.
 */
export class InMemoryTryOnResultRepository implements TryOnResultRepository {
  private readonly results = new Map<string, TryOnResultRecord>();

  async create(input: CreateTryOnResultInput): Promise<TryOnResultRecord> {
    const record: TryOnResultRecord = {
      id: randomUUID(),
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
      createdAt: new Date().toISOString(),
    };
    this.results.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  async findById(id: string): Promise<TryOnResultRecord | null> {
    const r = this.results.get(id);
    return r ? structuredClone(r) : null;
  }

  async findByUserId(userId: string): Promise<TryOnResultRecord[]> {
    const results: TryOnResultRecord[] = [];
    for (const r of this.results.values()) {
      if (r.userId === userId) results.push(structuredClone(r));
    }
    return results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async delete(id: string): Promise<void> {
    this.results.delete(id);
  }
}