import { Schema, model, models } from "mongoose";
import type { WardrobeItem, WardrobeCategory } from "@stylaiize/shared";

export interface WardrobeItemDocument {
  userId: string;
  name: string;
  category: WardrobeCategory;
  color: string;
  imageUrl: string | null;
  imagePublicId: string | null;
  brand: string | null;
  purchasedPrice: number | null;
  timesWorn: number;
  lastWornAt: string | null;
  costPerWear: number | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const WardrobeItemSchema = new Schema<WardrobeItemDocument>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    category: {
      type: String,
      required: true,
      enum: ["tops", "bottoms", "outerwear", "dresses", "footwear", "accessories", "bags", "ethnic", "sportswear"],
    },
    color: { type: String, required: true, trim: true, maxlength: 50 },
    imageUrl: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    brand: { type: String, default: null, trim: true },
    purchasedPrice: { type: Number, default: null },
    timesWorn: { type: Number, default: 0 },
    lastWornAt: { type: String, default: null },
    costPerWear: { type: Number, default: null },
    tags: { type: [String], default: [] },
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

export const WardrobeItemModel =
  models.WardrobeItem ?? model<WardrobeItemDocument>("WardrobeItem", WardrobeItemSchema);

export function toWardrobeItem(doc: WardrobeItemDocument & { _id: unknown }): WardrobeItem {
  return {
    id: doc._id?.toString() ?? "",
    userId: doc.userId,
    name: doc.name,
    category: doc.category,
    color: doc.color,
    imageUrl: doc.imageUrl ?? null,
    imagePublicId: doc.imagePublicId ?? null,
    brand: doc.brand ?? null,
    purchasedPrice: doc.purchasedPrice ?? null,
    timesWorn: doc.timesWorn ?? 0,
    lastWornAt: doc.lastWornAt ?? null,
    costPerWear: doc.costPerWear ?? null,
    tags: doc.tags ?? [],
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
