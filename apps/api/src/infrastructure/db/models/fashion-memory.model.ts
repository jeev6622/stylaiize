import { Schema, model, models } from "mongoose";
import type { FashionMemory, StyleProfile } from "@stylaiize/shared";

export interface FashionMemoryDocument {
  userId: string;
  previousOutfits: FashionMemory["previousOutfits"];
  attendedEvents: string[];
  favoriteBrands: string[];
  favoriteColors: string[];
  budget: { min: number; max: number } | null;
  sizes: Partial<Record<string, string>>;
  shoppingHistory: FashionMemory["shoppingHistory"];
  wardrobeOwned: string[];
  styleProfile: StyleProfile | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const PreviousOutfitSubschema = new Schema(
  {
    outfitId: { type: String, required: true },
    eventId: { type: String, required: true },
    wornAt: { type: String, required: true },
  },
  { _id: false },
);

const ShoppingHistorySubschema = new Schema(
  {
    productId: { type: String, required: true },
    purchasedAt: { type: String, required: true },
    price: { type: Number, required: true },
  },
  { _id: false },
);

const FashionMemorySchema = new Schema<FashionMemoryDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    previousOutfits: { type: [PreviousOutfitSubschema], default: [] },
    attendedEvents: { type: [String], default: [] },
    favoriteBrands: { type: [String], default: [] },
    favoriteColors: { type: [String], default: [] },
    budget: { type: { min: Number, max: Number }, default: null },
    sizes: { type: Schema.Types.Mixed, default: {} },
    shoppingHistory: { type: [ShoppingHistorySubschema], default: [] },
    wardrobeOwned: { type: [String], default: [] },
    styleProfile: { type: Schema.Types.Mixed, default: null },
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

export const FashionMemoryModel =
  models.FashionMemory ?? model<FashionMemoryDocument>("FashionMemory", FashionMemorySchema);

export function toFashionMemory(doc: FashionMemoryDocument & { _id: unknown }): FashionMemory {
  return {
    id: doc._id?.toString() ?? "",
    userId: doc.userId,
    previousOutfits: doc.previousOutfits ?? [],
    attendedEvents: doc.attendedEvents ?? [],
    favoriteBrands: doc.favoriteBrands ?? [],
    favoriteColors: doc.favoriteColors ?? [],
    budget: doc.budget ?? null,
    sizes: doc.sizes ?? {},
    shoppingHistory: doc.shoppingHistory ?? [],
    wardrobeOwned: doc.wardrobeOwned ?? [],
    styleProfile: (doc.styleProfile ?? null) as StyleProfile | null,
  };
}