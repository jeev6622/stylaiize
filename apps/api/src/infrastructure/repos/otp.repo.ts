import { getDatabaseStatus } from "@/config/mongodb";
import type { OTPRecord } from "@stylaiize/shared";
import type { OTPRepository } from "@/domain/ports/repositories";
import { OTPModel, toOTPRecord } from "@/infrastructure/db/models/otp.model";

/**
 * Mongoose-backed OTP repository.
 * Used whenever MongoDB is connected so OTPs validate reliably across
 * restarts; the in-memory demo repository is only used in demo mode.
 */
export class MongoOTPRepository implements OTPRepository {
  async create(record: OTPRecord): Promise<void> {
    await OTPModel.create({
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

  private async matchTarget(
    target: string,
    purpose: string,
  ): Promise<OTPRecord | null> {
    const now = new Date();
    const docs = await OTPModel.find({
      purpose,
      usedAt: null,
      expiresAt: { $gt: now },
    }).sort({ createdAt: 1 });

    const lowerTarget = target.toLowerCase();
    for (const doc of docs) {
      const record = toOTPRecord(doc);
      const matches =
        (record.email && record.email.toLowerCase() === lowerTarget) ||
        (record.mobile && record.countryCode && `${record.countryCode}${record.mobile}` === target);
      if (matches) return record;
    }
    return null;
  }

  async findByTarget(target: string, purpose: string): Promise<OTPRecord | null> {
    return this.matchTarget(target, purpose);
  }

  async findActive(target: string, purpose: string): Promise<OTPRecord | null> {
    return this.matchTarget(target, purpose);
  }

  async incrementAttempts(id: string): Promise<void> {
    await OTPModel.updateOne({ _id: id }, { $inc: { attempts: 1 } });
  }

  async markUsed(id: string): Promise<void> {
    await OTPModel.updateOne({ _id: id }, { $set: { usedAt: new Date() } });
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