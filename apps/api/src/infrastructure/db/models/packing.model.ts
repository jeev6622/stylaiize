import { Schema, model, models } from "mongoose";
import type { PackingList, PackingCategory } from "@stylaiize/shared";

export interface PackingListDocument {
  userId: string;
  title: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  items: Array<{
    id: string;
    name: string;
    category: PackingCategory;
    quantity: number;
    essential: boolean;
    packed: boolean;
  }>;
  weatherBasedAdjustments: string[];
  activities: string[];
  createdAt: Date;
  updatedAt: Date;
}

const PackingItemSubschema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    essential: { type: Boolean, required: true, default: false },
    packed: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const PackingListSchema = new Schema<PackingListDocument>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    destination: { type: String, required: true, trim: true, maxlength: 200 },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    items: [PackingItemSubschema],
    weatherBasedAdjustments: { type: [String], default: [] },
    activities: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const obj = ret as unknown as Record<string, unknown>;
        obj.id = String(obj._id);
        delete obj._id;
        delete obj.__v;
        return obj;
      },
    },
  },
);

export const PackingListModel =
  models.PackingList ?? model<PackingListDocument>("PackingList", PackingListSchema);

export function toPackingList(doc: PackingListDocument & { _id: unknown }): PackingList {
  return {
    id: doc._id?.toString() ?? "",
    userId: doc.userId,
    title: doc.title,
    destination: doc.destination,
    startDate: doc.startDate ?? null,
    endDate: doc.endDate ?? null,
    items: (doc.items ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category as PackingCategory,
      quantity: i.quantity,
      essential: i.essential,
      packed: i.packed,
    })),
    weatherBasedAdjustments: doc.weatherBasedAdjustments ?? [],
    activities: doc.activities ?? [],
    createdAt: doc.createdAt.toISOString(),
  };
}
