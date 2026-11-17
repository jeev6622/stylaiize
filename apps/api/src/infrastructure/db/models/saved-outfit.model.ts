import { Schema, model, models } from "mongoose";
import type { OutfitItem, OutfitScores, SavedOutfit, SavedOutfitSource } from "@stylaiize/shared";
import { SAVED_OUTFIT_SOURCES } from "@stylaiize/shared";

export interface SavedOutfitDocument {
  userId: string;
  name: string;
  category: string;
  occasion: string | null;
  style: string | null;
  colors: string[];
  budget: number | null;
  items: OutfitItem[];
  scores: OutfitScores;
  totalCost: number;
  imageUrl: string | null;
  explanation: string | null;
  grooming: unknown | null;
  source: SavedOutfitSource;
  createdAt: Date;
  updatedAt: Date;
}

const SavedOutfitSchema = new Schema<SavedOutfitDocument>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    category: { type: String, required: true, default: "casual" },
    occasion: { type: String, default: null },
    style: { type: String, default: null },
    colors: { type: [String], default: [] },
    budget: { type: Number, default: null },
    items: { type: Schema.Types.Mixed, default: [] },
    scores: { type: Schema.Types.Mixed, default: null },
    totalCost: { type: Number, default: null },
    imageUrl: { type: String, default: null },
    explanation: { type: String, default: null },
    grooming: { type: Schema.Types.Mixed, default: null },
    source: { type: String, enum: SAVED_OUTFIT_SOURCES, default: "manual" },
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

export const SavedOutfitModel =
  models.SavedOutfit ?? model<SavedOutfitDocument>("SavedOutfit", SavedOutfitSchema);

export function toSavedOutfit(doc: SavedOutfitDocument & { _id: unknown }): SavedOutfit {
  const id = doc._id?.toString() ?? "";
  const items = (doc.items ?? []) as OutfitItem[];
  const scores = (doc.scores ?? null) as OutfitScores | null;
  return {
    id,
    userId: doc.userId,
    name: doc.name,
    category: doc.category as SavedOutfit["category"],
    occasion: doc.occasion ?? null,
    style: doc.style ?? null,
    colors: doc.colors ?? [],
    budget: doc.budget ?? null,
    items,
    scores,
    totalCost: doc.totalCost ?? null,
    imageUrl: doc.imageUrl ?? null,
    explanation: doc.explanation ?? null,
    grooming: (doc.grooming ?? null) as SavedOutfit["grooming"],
    source: doc.source ?? "manual",
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
