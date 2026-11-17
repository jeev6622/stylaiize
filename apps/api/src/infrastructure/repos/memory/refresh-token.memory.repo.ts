import type { RefreshTokenRecord } from "@stylaiize/shared";
import type { RefreshTokenRepository } from "@/domain/ports/repositories";

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly store = new Map<string, RefreshTokenRecord>();

  async create(record: RefreshTokenRecord): Promise<void> {
    this.store.set(record.id, structuredClone(record));
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    for (const record of this.store.values()) {
      if (record.tokenHash === tokenHash) return structuredClone(record);
    }
    return null;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const now = new Date().toISOString();
    for (const record of this.store.values()) {
      if (record.userId === userId && !record.revokedAt) {
        record.revokedAt = now;
      }
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    const now = new Date().toISOString();
    for (const record of this.store.values()) {
      if (record.familyId === familyId && !record.revokedAt) {
        record.revokedAt = now;
      }
    }
  }

  async deleteExpired(): Promise<void> {
    const now = new Date().toISOString();
    for (const [id, record] of this.store) {
      if (record.expiresAt < now) {
        this.store.delete(id);
      }
    }
  }
}
