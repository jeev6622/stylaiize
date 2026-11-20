import { Schema, model, models } from "mongoose";
import type { OTPPurpose, OTPRecord } from "@stylaiize/shared";

export interface OTPDocument {
  target?: string | null;
  userId: string | null;
  email: string | null;
  mobile: string | null;
  countryCode: string | null;
  codeHash: string;
  purpose: OTPPurpose;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

const OTPSchema = new Schema<OTPDocument>(
  {
    target: { type: String, default: null, index: true },
    userId: { type: String, default: null, index: true },
    email: { type: String, default: null, index: true },
    mobile: { type: String, default: null },
    countryCode: { type: String, default: null },
    codeHash: { type: String, required: true },
    purpose: { type: String, required: true, index: true },
    attempts: { type: Number, required: true, default: 0 },
    maxAttempts: { type: Number, required: true, default: 5 },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
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

export const OTPModel = models.OTP ?? model<OTPDocument>("OTP", OTPSchema);

export function toOTPRecord(doc: OTPDocument & { _id: unknown }): OTPRecord {
  return {
    id: doc._id?.toString() ?? "",
    ...(doc.target ? { target: doc.target } : {}),
    userId: doc.userId ?? null,
    email: doc.email ?? null,
    mobile: doc.mobile ?? null,
    countryCode: doc.countryCode ?? null,
    codeHash: doc.codeHash,
    purpose: doc.purpose,
    attempts: doc.attempts,
    maxAttempts: doc.maxAttempts,
    expiresAt: (doc.expiresAt as Date).toISOString(),
    usedAt: doc.usedAt ? new Date(doc.usedAt).toISOString() : null,
    createdAt: (doc.createdAt as Date).toISOString(),
  };
}