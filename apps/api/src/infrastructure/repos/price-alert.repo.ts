import type {
  CreatePriceAlertInput,
  PriceAlertRepository,
} from "@/domain/ports/repositories";
import type { PriceAlert } from "@stylaiize/shared";
import { getDatabaseStatus } from "@/config/mongodb";
import {
  PriceAlertModel,
  toPriceAlert,
} from "@/infrastructure/db/models/price-alert.model";

class MongoPriceAlertRepository implements PriceAlertRepository {
  async create(input: CreatePriceAlertInput): Promise<PriceAlert> {
    const doc = await PriceAlertModel.create({
      userId: input.userId,
      productId: input.productId,
      targetPrice: input.targetPrice,
      conditions: input.conditions,
      channels: input.channels,
      status: "active",
      triggeredAt: null,
    });
    return toPriceAlert(doc);
  }

  async findById(id: string): Promise<PriceAlert | null> {
    const doc = await PriceAlertModel.findById(id);
    return doc ? toPriceAlert(doc) : null;
  }

  async findByUserId(userId: string): Promise<PriceAlert[]> {
    const docs = await PriceAlertModel.find({ userId }).sort({ createdAt: -1 });
    return docs.map((d) => toPriceAlert(d));
  }

  async findByStatus(status: PriceAlert["status"]): Promise<PriceAlert[]> {
    const docs = await PriceAlertModel.find({ status });
    return docs.map((d) => toPriceAlert(d));
  }

  async update(
    id: string,
    patch: Partial<Pick<PriceAlert, "targetPrice" | "conditions" | "channels" | "status" | "triggeredAt">>,
  ): Promise<PriceAlert | null> {
    const doc = await PriceAlertModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true },
    );
    return doc ? toPriceAlert(doc) : null;
  }

  async delete(id: string): Promise<void> {
    await PriceAlertModel.findByIdAndDelete(id);
  }
}

/** Returns the appropriate price alert repository for the current database state. */
export function priceAlertRepository(): PriceAlertRepository {
  return getDatabaseStatus().demoMode
    ? demoPriceAlertRepository ?? mongoPriceAlertRepository
    : mongoPriceAlertRepository;
}

let demoPriceAlertRepository: PriceAlertRepository | null = null;

export function registerDemoPriceAlertRepository(repo: PriceAlertRepository): void {
  demoPriceAlertRepository = repo;
}

const mongoPriceAlertRepository = new MongoPriceAlertRepository();