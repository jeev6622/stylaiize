import type { OTPRecord } from "@stylaiize/shared";
import type { OTPRepository } from "@/domain/ports/repositories";

function matchesTarget(record: OTPRecord, target: string): boolean {
  const normalized = target.toLowerCase();
  if (record.target && record.target.toLowerCase() === normalized) return true;
  if (record.email && record.email.toLowerCase() === normalized) return true;
  if (record.mobile && record.countryCode) {
    return `${record.countryCode}${record.mobile}`.toLowerCase() === normalized;
  }
  return false;
}

function isActive(record: OTPRecord, now = Date.now()): boolean {
  return !record.usedAt && new Date(record.expiresAt).getTime() > now && record.attempts < record.maxAttempts;
}

export class InMemoryOTPRepository implements OTPRepository {
  private readonly store = new Map<string, OTPRecord>();

  async create(record: OTPRecord): Promise<void> {
    this.store.set(record.id, structuredClone(record));
  }

  async findByTarget(target: string, purpose: string): Promise<OTPRecord | null> {
    const records = [...this.store.values()]
      .filter((record) => record.purpose === purpose && matchesTarget(record, target))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const record = records[0];
    return record ? structuredClone(record) : null;
  }

  async findActive(target: string, purpose: string): Promise<OTPRecord | null> {
    const now = Date.now();
    const records = [...this.store.values()]
      .filter(
        (record) =>
          record.purpose === purpose &&
          matchesTarget(record, target) &&
          !record.usedAt &&
          new Date(record.expiresAt).getTime() > now,
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const record = records[0];
    return record ? structuredClone(record) : null;
  }

  async incrementAttempts(id: string): Promise<void> {
    const record = this.store.get(id);
    if (record) {
      record.attempts += 1;
    }
  }

  async incrementAttemptsIfActive(id: string): Promise<boolean> {
    const record = this.store.get(id);
    if (!record || !isActive(record)) return false;
    record.attempts += 1;
    return true;
  }

  async markUsed(id: string): Promise<void> {
    const record = this.store.get(id);
    if (record) {
      record.usedAt = new Date().toISOString();
    }
  }

  async consume(id: string): Promise<boolean> {
    const record = this.store.get(id);
    if (!record || !isActive(record)) return false;
    record.usedAt = new Date().toISOString();
    return true;
  }

  async consumeForOwner(id: string, ownerId: string): Promise<boolean> {
    const record = this.store.get(id);
    if (!record || record.userId !== ownerId || !isActive(record)) return false;
    record.usedAt = new Date().toISOString();
    return true;
  }

  async invalidateActiveForTarget(target: string, purpose: string): Promise<void> {
    const now = new Date().toISOString();
    for (const record of this.store.values()) {
      if (
        record.purpose === purpose &&
        matchesTarget(record, target) &&
        !record.usedAt &&
        new Date(record.expiresAt).getTime() > Date.now()
      ) {
        record.usedAt = now;
      }
    }
  }

  async invalidate(id: string): Promise<void> {
    const record = this.store.get(id);
    if (record) {
      record.usedAt = new Date().toISOString();
    }
  }

  async countRecentForTarget(target: string, purpose: string, since: Date): Promise<number> {
    const sinceMs = since.getTime();
    let count = 0;
    for (const record of this.store.values()) {
      if (
        record.purpose === purpose &&
        matchesTarget(record, target) &&
        new Date(record.createdAt).getTime() >= sinceMs
      ) {
        count += 1;
      }
    }
    return count;
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
