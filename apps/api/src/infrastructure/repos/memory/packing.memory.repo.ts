import { randomUUID } from "node:crypto";
import type { PackingList } from "@stylaiize/shared";
import type {
  PackingListRepository,
  CreatePackingListInput,
} from "@/domain/ports/repositories";

/**
 * In-memory packing list repository for demo mode (no MongoDB configured).
 * Data is intentionally not persisted across restarts.
 */
export class InMemoryPackingListRepository implements PackingListRepository {
  private readonly lists = new Map<string, PackingList>();

  async create(input: CreatePackingListInput): Promise<PackingList> {
    const now = new Date().toISOString();
    const list: PackingList = {
      id: randomUUID(),
      userId: input.userId,
      title: input.title,
      destination: input.destination,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      items: [],
      weatherBasedAdjustments: [],
      activities: [],
      createdAt: now,
    };
    this.lists.set(list.id, structuredClone(list));
    return structuredClone(list);
  }

  async findById(id: string): Promise<PackingList | null> {
    const list = this.lists.get(id);
    return list ? structuredClone(list) : null;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<PackingList | null> {
    const list = this.lists.get(id);
    if (!list || list.userId !== userId) return null;
    return structuredClone(list);
  }

  async findByUserId(userId: string): Promise<PackingList[]> {
    const results: PackingList[] = [];
    for (const list of this.lists.values()) {
      if (list.userId === userId) results.push(structuredClone(list));
    }
    return results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async update(
    id: string,
    patch: Partial<Pick<PackingList, "title" | "destination" | "startDate" | "endDate" | "items" | "weatherBasedAdjustments" | "activities">>,
  ): Promise<PackingList | null> {
    const existing = this.lists.get(id);
    if (!existing) return null;
    const updated: PackingList = {
      ...existing,
      ...patch,
    };
    this.lists.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async delete(id: string): Promise<void> {
    this.lists.delete(id);
  }
}
