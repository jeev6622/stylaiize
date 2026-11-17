import { getDatabaseStatus } from "@/config/mongodb";
import type { PackingList } from "@stylaiize/shared";
import { PackingListModel, toPackingList } from "@/infrastructure/db/models/packing.model";
import type {
  PackingListRepository,
  CreatePackingListInput,
} from "@/domain/ports/repositories";

/**
 * Mongoose-backed packing list repository.
 * Used whenever MongoDB is connected; otherwise callers use the
 * in-memory demo repository.
 */
export class MongoPackingListRepository implements PackingListRepository {
  async create(input: CreatePackingListInput): Promise<PackingList> {
    const doc = await PackingListModel.create({
      userId: input.userId,
      title: input.title,
      destination: input.destination,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      items: [],
      weatherBasedAdjustments: [],
      activities: [],
    });
    return toPackingList(doc);
  }

  async findById(id: string): Promise<PackingList | null> {
    const doc = await PackingListModel.findById(id);
    return doc ? toPackingList(doc) : null;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<PackingList | null> {
    const doc = await PackingListModel.findOne({ _id: id, userId });
    return doc ? toPackingList(doc) : null;
  }

  async findByUserId(userId: string): Promise<PackingList[]> {
    const docs = await PackingListModel.find({ userId }).sort({ createdAt: -1 });
    return docs.map(toPackingList);
  }

  async update(
    id: string,
    patch: Partial<Pick<PackingList, "title" | "destination" | "startDate" | "endDate" | "items" | "weatherBasedAdjustments" | "activities">>,
  ): Promise<PackingList | null> {
    const doc = await PackingListModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true },
    );
    return doc ? toPackingList(doc) : null;
  }

  async delete(id: string): Promise<void> {
    await PackingListModel.findByIdAndDelete(id);
  }
}

/** Returns the appropriate packing list repository for the current database state. */
export function packingListRepository(): PackingListRepository {
  const db = getDatabaseStatus();
  if (!db.demoMode) return mongoPackingListRepository;
  return demoPackingListRepository ?? mongoPackingListRepository;
}

let demoPackingListRepository: PackingListRepository | null = null;

export function registerDemoPackingListRepository(repo: PackingListRepository): void {
  demoPackingListRepository = repo;
}

const mongoPackingListRepository = new MongoPackingListRepository();
