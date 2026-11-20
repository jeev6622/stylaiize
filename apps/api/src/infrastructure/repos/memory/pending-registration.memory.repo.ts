import { randomUUID } from "node:crypto";
import type { PendingRegistration } from "@stylaiize/shared";
import type {
  CreatePendingRegistrationInput,
  PendingRegistrationRepository,
} from "@/domain/ports/repositories";

export class InMemoryPendingRegistrationRepository implements PendingRegistrationRepository {
  private readonly store = new Map<string, PendingRegistration>();

  async create(input: CreatePendingRegistrationInput): Promise<PendingRegistration> {
    const now = new Date().toISOString();
    const record: PendingRegistration = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  async findById(id: string): Promise<PendingRegistration | null> {
    const record = this.store.get(id);
    return record ? structuredClone(record) : null;
  }

  async findByEmail(email: string): Promise<PendingRegistration | null> {
    const lower = email.toLowerCase();
    for (const record of this.store.values()) {
      if (record.email.toLowerCase() === lower) return structuredClone(record);
    }
    return null;
  }

  async findByMobile(mobile: string): Promise<PendingRegistration | null> {
    const lower = mobile.toLowerCase();
    for (const record of this.store.values()) {
      if (record.mobile.toLowerCase() === lower) return structuredClone(record);
    }
    return null;
  }

  async update(
    id: string,
    patch: Partial<Pick<PendingRegistration, "emailVerified" | "mobileVerified" | "emailOtpId" | "mobileOtpId">>,
  ): Promise<PendingRegistration | null> {
    const record = this.store.get(id);
    if (!record) return null;
    const updated = { ...record, ...patch, updatedAt: new Date().toISOString() };
    this.store.set(id, updated);
    return structuredClone(updated);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async deleteExpired(now = new Date()): Promise<void> {
    const nowMs = now.getTime();
    for (const [id, record] of this.store) {
      if (new Date(record.expiresAt).getTime() < nowMs) this.store.delete(id);
    }
  }
}
