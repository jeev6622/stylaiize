import type { FilterQuery } from "mongoose";
import { getDatabaseStatus } from "@/config/mongodb";
import type { OTPRecord } from "@stylaiize/shared";
import type { OTPRepository } from "@/domain/ports/repositories";
import { OTPModel, toOTPRecord, type OTPDocument } from "@/infrastructure/db/models/otp.model";

type OTPQuery = FilterQuery<OTPDocument>;

function targetQuery(target: string): Record<string, unknown> {
  const normalized = target.toLowerCase();
  if (normalized.includes("@")) {
    return { $or: [{ target: normalized }, { email: normalized }] };
  }
  return {
    $or: [
      { target: normalized },
      { $expr: { $eq: [{ $concat: ["$countryCode", "$mobile"] }, normalized] } },
    ],
  };
}

function buildQuery(
  target: string,
  purpose: string,
  options: { activeOnly?: boolean; since?: Date } = {},
): OTPQuery {
  const query: Record<string, unknown> = { purpose, ...targetQuery(target) };
  if (options.activeOnly) {
    query.usedAt = null;
    query.expiresAt = { $gt: new Date() };
  }
  if (options.since) {
    query.createdAt = { $gte: options.since };
  }
  return query as OTPQuery;
}

function activeIdQuery(id: string, ownerId?: string): OTPQuery {
  return {
    _id: id,
    ...(ownerId ? { userId: ownerId } : {}),
    usedAt: null,
    expiresAt: { $gt: new Date() },
    $expr: { $lt: ["$attempts", "$maxAttempts"] },
  } as OTPQuery;
}

export class MongoOTPRepository implements OTPRepository {
  async create(record: OTPRecord): Promise<void> {
    await OTPModel.create({
      target: record.target ?? null,
      userId: record.userId,
      email: record.email,
      mobile: record.mobile,
      countryCode: record.countryCode,
      codeHash: record.codeHash,
      purpose: record.purpose,
      attempts: record.attempts,
      maxAttempts: record.maxAttempts,
      expiresAt: new Date(record.expiresAt),
      usedAt: record.usedAt ? new Date(record.usedAt) : null,
      createdAt: new Date(record.createdAt),
    });
  }

  async findActive(target: string, purpose: string): Promise<OTPRecord | null> {
    const doc = await OTPModel.findOne(buildQuery(target, purpose, { activeOnly: true })).sort({
      createdAt: -1,
    });
    return doc ? toOTPRecord(doc as OTPDocument & { _id: unknown }) : null;
  }

  async findByTarget(target: string, purpose: string): Promise<OTPRecord | null> {
    const doc = await OTPModel.findOne(buildQuery(target, purpose)).sort({ createdAt: -1 });
    return doc ? toOTPRecord(doc as OTPDocument & { _id: unknown }) : null;
  }

  async incrementAttempts(id: string): Promise<void> {
    await OTPModel.updateOne({ _id: id }, { $inc: { attempts: 1 } });
  }

  async incrementAttemptsIfActive(id: string): Promise<boolean> {
    const updated = await OTPModel.findOneAndUpdate(
      activeIdQuery(id),
      { $inc: { attempts: 1 } },
      { new: true },
    );
    return updated !== null;
  }

  async markUsed(id: string): Promise<void> {
    await OTPModel.updateOne({ _id: id }, { $set: { usedAt: new Date() } });
  }

  async consume(id: string): Promise<boolean> {
    const updated = await OTPModel.findOneAndUpdate(
      activeIdQuery(id),
      { $set: { usedAt: new Date() } },
      { new: true },
    );
    return updated !== null;
  }

  async consumeForOwner(id: string, ownerId: string): Promise<boolean> {
    const updated = await OTPModel.findOneAndUpdate(
      activeIdQuery(id, ownerId),
      { $set: { usedAt: new Date() } },
      { new: true },
    );
    return updated !== null;
  }

  async invalidateActiveForTarget(target: string, purpose: string): Promise<void> {
    await OTPModel.updateMany(buildQuery(target, purpose, { activeOnly: true }), {
      $set: { usedAt: new Date() },
    });
  }

  async invalidate(id: string): Promise<void> {
    await OTPModel.updateOne({ _id: id }, { $set: { usedAt: new Date() } });
  }

  async countRecentForTarget(target: string, purpose: string, since: Date): Promise<number> {
    return OTPModel.countDocuments(buildQuery(target, purpose, { since }));
  }

  async deleteExpired(): Promise<void> {
    await OTPModel.deleteMany({ expiresAt: { $lt: new Date() } });
  }
}

export function otpRepository(): OTPRepository {
  const db = getDatabaseStatus();
  if (!db.demoMode) return mongoOTPRepository;
  if (demoOTPRepository) return demoOTPRepository;
  throw new Error("OTP repository not registered. Call registerDemoOTPRepository() at bootstrap.");
}

let demoOTPRepository: OTPRepository | null = null;

export function registerDemoOTPRepository(repo: OTPRepository): void {
  demoOTPRepository = repo;
}

const mongoOTPRepository = new MongoOTPRepository();
