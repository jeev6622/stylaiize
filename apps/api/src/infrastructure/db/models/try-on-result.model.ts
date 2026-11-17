import { Schema, model, models } from "mongoose";
import type { TryOnResultRecord } from "@stylaiize/shared";

export interface TryOnResultDocument {
  userId: string;
  provider: string;
  category?: string | null;
  personImage?: string | null;
  garmentImage?: string | null;
  garmentLabel?: string | null;
  resultImage?: string | null;
  mimeType?: string | null;
  sourceUrl?: string | null;
  processingTimeMs?: number | null;
  createdAt: Date;
}

const TryOnResultSchema = new Schema<TryOnResultDocument>(
  {
    userId: { type: String, required: true, index: true },
    provider: { type: String, required: true },
    category: { type: String, default: null },
    personImage: { type: String, default: null },
    garmentImage: { type: String, default: null },
    garmentLabel: { type: String, default: null },
    resultImage: { type: String, default: null },
    mimeType: { type: String, default: null },
    sourceUrl: { type: String, default: null },
    processingTimeMs: { type: Number, default: null },
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

export const TryOnResultModel =
  models.TryOnResult ??
  model<TryOnResultDocument>("TryOnResult", TryOnResultSchema);

export function toTryOnResult(
  doc: TryOnResultDocument & { _id: unknown },
): TryOnResultRecord {
  return {
    id: doc._id?.toString() ?? "",
    userId: doc.userId,
    provider: doc.provider as TryOnResultRecord["provider"],
    category: doc.category ?? null,
    personImage: doc.personImage ?? null,
    garmentImage: doc.garmentImage ?? null,
    garmentLabel: doc.garmentLabel ?? null,
    resultImage: doc.resultImage ?? null,
    mimeType: doc.mimeType ?? null,
    sourceUrl: doc.sourceUrl ?? null,
    processingTimeMs: doc.processingTimeMs ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}