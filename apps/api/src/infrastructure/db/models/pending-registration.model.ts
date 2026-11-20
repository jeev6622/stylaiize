import { Schema, model, models } from "mongoose";
import type { PendingRegistration } from "@stylaiize/shared";

export interface PendingRegistrationDocument {
  name: string;
  email: string;
  emailLower: string;
  mobile: string;
  mobileLower: string;
  countryCode: string;
  passwordHash: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  emailOtpId: string | null;
  mobileOtpId: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PendingRegistrationSchema = new Schema<PendingRegistrationDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true },
    emailLower: { type: String, required: true, trim: true, lowercase: true, unique: true },
    mobile: { type: String, required: true, trim: true },
    mobileLower: { type: String, required: true, trim: true, lowercase: true, unique: true },
    countryCode: { type: String, required: true, default: "+91" },
    passwordHash: { type: String, required: true },
    emailVerified: { type: Boolean, required: true, default: false },
    mobileVerified: { type: Boolean, required: true, default: false },
    emailOtpId: { type: String, default: null },
    mobileOtpId: { type: String, default: null },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
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
        delete obj.passwordHash;
        return obj;
      },
    },
  },
);

export const PendingRegistrationModel =
  models.PendingRegistration ??
  model<PendingRegistrationDocument>("PendingRegistration", PendingRegistrationSchema);

export function toPendingRegistration(
  doc: PendingRegistrationDocument & { _id: unknown },
): PendingRegistration {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    mobile: doc.mobile,
    countryCode: doc.countryCode,
    passwordHash: doc.passwordHash,
    emailVerified: doc.emailVerified,
    mobileVerified: doc.mobileVerified,
    emailOtpId: doc.emailOtpId ?? null,
    mobileOtpId: doc.mobileOtpId ?? null,
    expiresAt: doc.expiresAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
