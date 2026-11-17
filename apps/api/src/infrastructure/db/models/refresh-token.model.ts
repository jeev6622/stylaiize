import { Schema, model, models } from "mongoose";
import type { RefreshTokenRecord } from "@stylaiize/shared";

export interface RefreshTokenDocument {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<RefreshTokenDocument>(
  {
    userId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

export const RefreshTokenModel =
  models.RefreshToken ??
  model<RefreshTokenDocument>("RefreshToken", RefreshTokenSchema);

export function toRefreshTokenRecord(
  doc: RefreshTokenDocument & { _id: unknown },
): RefreshTokenRecord {
  return {
    id: doc._id?.toString() ?? "",
    userId: doc.userId,
    tokenHash: doc.tokenHash,
    familyId: doc.familyId,
    expiresAt: (doc.expiresAt as Date).toISOString(),
    revokedAt: doc.revokedAt ? new Date(doc.revokedAt).toISOString() : null,
    createdAt: (doc.createdAt as Date).toISOString(),
  };
}