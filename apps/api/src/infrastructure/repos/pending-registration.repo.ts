import { getDatabaseStatus } from "@/config/mongodb";
import type { PendingRegistration } from "@stylaiize/shared";
import type {
  CreatePendingRegistrationInput,
  PendingRegistrationRepository,
} from "@/domain/ports/repositories";
import {
  PendingRegistrationModel,
  toPendingRegistration,
  type PendingRegistrationDocument,
} from "@/infrastructure/db/models/pending-registration.model";

export class MongoPendingRegistrationRepository implements PendingRegistrationRepository {
  async create(input: CreatePendingRegistrationInput): Promise<PendingRegistration> {
    const doc = await PendingRegistrationModel.create({
      ...input,
      emailLower: input.email.toLowerCase(),
      mobileLower: input.mobile.toLowerCase(),
      expiresAt: new Date(input.expiresAt),
    });
    return toPendingRegistration(doc as PendingRegistrationDocument & { _id: unknown });
  }

  async findById(id: string): Promise<PendingRegistration | null> {
    const doc = await PendingRegistrationModel.findById(id);
    return doc ? toPendingRegistration(doc as PendingRegistrationDocument & { _id: unknown }) : null;
  }

  async findByEmail(email: string): Promise<PendingRegistration | null> {
    const doc = await PendingRegistrationModel.findOne({ emailLower: email.toLowerCase() });
    return doc ? toPendingRegistration(doc as PendingRegistrationDocument & { _id: unknown }) : null;
  }

  async findByMobile(mobile: string): Promise<PendingRegistration | null> {
    const doc = await PendingRegistrationModel.findOne({ mobileLower: mobile.toLowerCase() });
    return doc ? toPendingRegistration(doc as PendingRegistrationDocument & { _id: unknown }) : null;
  }

  async update(
    id: string,
    patch: Partial<Pick<PendingRegistration, "emailVerified" | "mobileVerified" | "emailOtpId" | "mobileOtpId">>,
  ): Promise<PendingRegistration | null> {
    const doc = await PendingRegistrationModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true },
    );
    return doc ? toPendingRegistration(doc as PendingRegistrationDocument & { _id: unknown }) : null;
  }

  async delete(id: string): Promise<void> {
    await PendingRegistrationModel.findByIdAndDelete(id);
  }

  async deleteExpired(now = new Date()): Promise<void> {
    await PendingRegistrationModel.deleteMany({ expiresAt: { $lt: now } });
  }
}

const mongoRepository = new MongoPendingRegistrationRepository();
let demoRepository: PendingRegistrationRepository | null = null;

export function pendingRegistrationRepository(): PendingRegistrationRepository {
  const db = getDatabaseStatus();
  if (!db.demoMode) return mongoRepository;
  if (demoRepository) return demoRepository;
  throw new Error("Pending registration repository not registered. Call registerDemoPendingRegistrationRepository() at bootstrap.");
}

export function registerDemoPendingRegistrationRepository(repo: PendingRegistrationRepository): void {
  demoRepository = repo;
}
