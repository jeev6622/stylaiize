import { Schema, model, models } from "mongoose";
import type { User } from "@stylaiize/shared";

export interface UserDocument {
  name: string;
  email: string;
  emailLower: string;
  mobile: string | null;
  countryCode: string | null;
  mobileLower: string | null;
  mobileVerified: boolean;
  avatarUrl: string | null;
  role: "user" | "admin";
  emailVerified: boolean;
  passwordHash: string | null;
  googleId: string | null;
  providers: Array<"email" | "google">;
  gender?: string | null;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true },
    emailLower: { type: String, required: true, unique: true, lowercase: true },
    mobile: { type: String, default: null },
    countryCode: { type: String, default: null },
    mobileLower: { type: String, default: null, unique: true, sparse: true },
    mobileVerified: { type: Boolean, default: false },
    avatarUrl: { type: String, default: null },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    emailVerified: { type: Boolean, default: false },
    passwordHash: { type: String, default: null },
    googleId: { type: String, default: null, index: { sparse: true } },
    providers: { type: [String], default: [] },
    gender: { type: String, default: null },
    preferences: { type: Schema.Types.Mixed, default: {} },
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

export const UserModel = models.User ?? model<UserDocument>("User", UserSchema);

export function toUser(doc: UserDocument & { _id: unknown }): User {
  const id = doc._id?.toString() ?? "";
  const prefs = (doc.preferences ?? {}) as unknown as User["preferences"];
  return {
    id,
    name: doc.name,
    email: doc.email,
    mobile: doc.mobile ?? null,
    countryCode: doc.countryCode ?? null,
    mobileVerified: doc.mobileVerified ?? false,
    avatarUrl: doc.avatarUrl,
    role: doc.role,
    emailVerified: doc.emailVerified,
    providers: doc.providers,
    googleId: doc.googleId,
    passwordHash: doc.passwordHash ?? null,
    gender: (doc.gender as User["gender"]) ?? null,
    preferences: {
      budgetRange: prefs.budgetRange ?? null,
      favoriteColors: prefs.favoriteColors ?? [],
      favoriteBrands: prefs.favoriteBrands ?? [],
      sizes: prefs.sizes ?? {},
      stylePreferences: prefs.stylePreferences ?? [],
      notificationChannels: prefs.notificationChannels ?? ["email"],
      emailNotifications: prefs.emailNotifications ?? true,
      pushNotifications: prefs.pushNotifications ?? false,
      deviceTokens: prefs.deviceTokens ?? [],
      units: prefs.units ?? "metric",
      favoriteProducts: prefs.favoriteProducts ?? [],
    },
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
