import { randomUUID } from "node:crypto";
import type { PriceAlert } from "@stylaiize/shared";
import type {
  CreatePriceAlertInput,
  PriceAlertRepository,
} from "@/domain/ports/repositories";

/**
 * In-memory price alert repository for demo mode (no MongoDB configured).
 */
export class InMemoryPriceAlertRepository implements PriceAlertRepository {
  private readonly store = new Map<string, PriceAlert>();

  async create(input: CreatePriceAlertInput): Promise<PriceAlert> {
    const alert: PriceAlert = {
      id: randomUUID(),
      userId: input.userId,
      productId: input.productId,
      targetPrice: input.targetPrice,
      conditions: input.conditions,
      channels: input.channels,
      status: "active",
      triggeredAt: null,
      createdAt: new Date().toISOString(),
    };
    this.store.set(alert.id, structuredClone(alert));
    return structuredClone(alert);
  }

  async findById(id: string): Promise<PriceAlert | null> {
    const a = this.store.get(id);
    return a ? structuredClone(a) : null;
  }

  async findByUserId(userId: string): Promise<PriceAlert[]> {
    return [...this.store.values()]
      .filter((a) => a.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((a) => structuredClone(a));
  }

  async findByStatus(status: PriceAlert["status"]): Promise<PriceAlert[]> {
    return [...this.store.values()].filter((a) => a.status === status).map((a) => structuredClone(a));
  }

  async update(
    id: string,
    patch: Partial<Pick<PriceAlert, "targetPrice" | "conditions" | "channels" | "status" | "triggeredAt">>,
  ): Promise<PriceAlert | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated: PriceAlert = { ...existing, ...patch };
    this.store.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}