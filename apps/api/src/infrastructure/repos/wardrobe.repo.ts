import { getDatabaseStatus } from "@/config/mongodb";
import type { WardrobeItem, WardrobeCategory } from "@stylaiize/shared";
import { WardrobeItemModel, toWardrobeItem } from "@/infrastructure/db/models/wardrobe.model";
import type {
  WardrobeRepository,
  CreateWardrobeItemInput,
} from "@/domain/ports/repositories";

/**
 * Mongoose-backed wardrobe repository.
 * Used whenever MongoDB is connected; otherwise callers use the
 * in-memory demo repository.
 */
export class MongoWardrobeRepository implements WardrobeRepository {
  async create(input: CreateWardrobeItemInput): Promise<WardrobeItem> {
    const doc = await WardrobeItemModel.create({
      userId: input.userId,
      name: input.name,
      category: input.category,
      color: input.color,
      imageUrl: input.imageUrl ?? null,
      imagePublicId: input.imagePublicId ?? null,
      brand: input.brand ?? null,
      purchasedPrice: input.purchasedPrice ?? null,
      timesWorn: 0,
      lastWornAt: null,
      costPerWear: null,
      tags: input.tags ?? [],
    });
    return toWardrobeItem(doc);
  }

  async findById(id: string): Promise<WardrobeItem | null> {
    const doc = await WardrobeItemModel.findById(id);
    return doc ? toWardrobeItem(doc) : null;
  }

  async findByUserId(userId: string): Promise<WardrobeItem[]> {
    const docs = await WardrobeItemModel.find({ userId }).sort({ createdAt: -1 });
    return docs.map(toWardrobeItem);
  }

  async findByUserIdAndCategory(userId: string, category: WardrobeCategory): Promise<WardrobeItem[]> {
    const docs = await WardrobeItemModel.find({ userId, category }).sort({ createdAt: -1 });
    return docs.map(toWardrobeItem);
  }

  async update(
    id: string,
    patch: Partial<Pick<WardrobeItem, "name" | "category" | "color" | "imageUrl" | "imagePublicId" | "brand" | "purchasedPrice" | "timesWorn" | "lastWornAt" | "tags">>,
  ): Promise<WardrobeItem | null> {
    const doc = await WardrobeItemModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true },
    );
    return doc ? toWardrobeItem(doc) : null;
  }

  async incrementWear(id: string, wornAt: string): Promise<WardrobeItem | null> {
    // `$inc` keeps concurrent wears from overwriting each other.
    const doc = await WardrobeItemModel.findByIdAndUpdate(
      id,
      { $inc: { timesWorn: 1 }, $set: { lastWornAt: wornAt } },
      { new: true, runValidators: true },
    );
    if (!doc) return null;
    if (doc.purchasedPrice !== null && doc.purchasedPrice !== undefined) {
      doc.costPerWear =
        doc.timesWorn > 0
          ? Math.round((doc.purchasedPrice / doc.timesWorn) * 100) / 100
          : null;
      await WardrobeItemModel.updateOne(
        { _id: doc._id },
        { $set: { costPerWear: doc.costPerWear } },
      );
    }
    return toWardrobeItem(doc);
  }

  async delete(id: string): Promise<void> {
    await WardrobeItemModel.findByIdAndDelete(id);
  }

  async countByUserId(userId: string): Promise<number> {
    return WardrobeItemModel.countDocuments({ userId });
  }

  async countAll(): Promise<number> {
    return WardrobeItemModel.countDocuments();
  }
}

/** Returns the appropriate wardrobe repository for the current database state. */
export function wardrobeRepository(): WardrobeRepository {
  const db = getDatabaseStatus();
  if (!db.demoMode) return mongoWardrobeRepository;
  return demoWardrobeRepository ?? mongoWardrobeRepository;
}

let demoWardrobeRepository: WardrobeRepository | null = null;

export function registerDemoWardrobeRepository(repo: WardrobeRepository): void {
  demoWardrobeRepository = repo;
}

const mongoWardrobeRepository = new MongoWardrobeRepository();
