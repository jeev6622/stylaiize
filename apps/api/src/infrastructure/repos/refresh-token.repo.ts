import { getDatabaseStatus } from "@/config/mongodb";
import type { RefreshTokenRecord } from "@stylaiize/shared";
import type { RefreshTokenRepository } from "@/domain/ports/repositories";
import {
  RefreshTokenModel,
  toRefreshTokenRecord,
} from "@/infrastructure/db/models/refresh-token.model";

/**
 * Mongoose-backed refresh-token repository.
 * Used whenever MongoDB is connected so sessions survive restarts;
 * the in-memory demo repository is only used in demo mode.
 */
export class MongoRefreshTokenRepository implements RefreshTokenRepository {
  async create(record: RefreshTokenRecord): Promise<void> {
    await RefreshTokenModel.create({
      userId: record.userId,
      tokenHash: record.tokenHash,
      familyId: record.familyId,
      expiresAt: new Date(record.expiresAt),
      revokedAt: record.revokedAt ? new Date(record.revokedAt) : null,
      createdAt: new Date(record.createdAt),
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const doc = await RefreshTokenModel.findOne({ tokenHash });
    return doc ? toRefreshTokenRecord(doc) : null;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await RefreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  async revokeFamily(familyId: string): Promise<void> {
    await RefreshTokenModel.updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  async deleteExpired(): Promise<void> {
    await RefreshTokenModel.deleteMany({ expiresAt: { $lt: new Date() } });
  }
}

export function refreshTokenRepository(): RefreshTokenRepository {
  const db = getDatabaseStatus();
  if (!db.demoMode) return mongoRefreshTokenRepository;
  if (demoRefreshTokenRepository) return demoRefreshTokenRepository;
  throw new Error(
    "RefreshToken repository not registered. Call registerDemoRefreshTokenRepository() at bootstrap.",
  );
}

let demoRefreshTokenRepository: RefreshTokenRepository | null = null;

export function registerDemoRefreshTokenRepository(repo: RefreshTokenRepository): void {
  demoRefreshTokenRepository = repo;
}

const mongoRefreshTokenRepository = new MongoRefreshTokenRepository();