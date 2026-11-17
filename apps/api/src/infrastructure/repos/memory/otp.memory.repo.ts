import type { OTPRecord } from "@stylaiize/shared";
import type { OTPRepository } from "@/domain/ports/repositories";

export class InMemoryOTPRepository implements OTPRepository {
  private readonly store = new Map<string, OTPRecord>();

  async create(record: OTPRecord): Promise<void> {
    this.store.set(record.id, structuredClone(record));
  }

  async findByTarget(target: string, purpose: string): Promise<OTPRecord | null> {
    return this.findActive(target, purpose);
  }

  async findActive(target: string, purpose: string): Promise<OTPRecord | null> {
    for (const record of this.store.values()) {
      if (record.purpose !== purpose) continue;
      if (record.usedAt) continue;
      const match =
        (record.email && record.email === target) ||
        (record.mobile && record.countryCode && `${record.countryCode}${record.mobile}` === target);
      if (match) return structuredClone(record);
    }
    return null;
  }

  async incrementAttempts(id: string): Promise<void> {
    const record = this.store.get(id);
    if (record) {
      record.attempts += 1;
    }
  }

  async markUsed(id: string): Promise<void> {
    const record = this.store.get(id);
    if (record) {
      record.usedAt = new Date().toISOString();
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
