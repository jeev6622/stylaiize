import { Schema, model, models } from "mongoose";
import type { AlertChannel, PriceAlert, PriceAlertCondition } from "@stylaiize/shared";

export interface PriceAlertDocument {
  userId: string;
  productId: string;
  targetPrice: number | null;
  conditions: PriceAlertCondition[];
  channels: AlertChannel[];
  status: PriceAlert["status"];
  triggeredAt: string | null;
  createdAt?: Date;
}

export interface AppNotificationDocument {
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt?: Date;
}

const PriceAlertSchema = new Schema<PriceAlertDocument>(
  {
    userId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    targetPrice: { type: Number, default: null },
    conditions: { type: [String], default: [] },
    channels: { type: [String], default: ["email"] },
    status: { type: String, enum: ["active", "triggered", "expired"], default: "active" },
    triggeredAt: { type: String, default: null },
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

const AppNotificationSchema = new Schema<AppNotificationDocument>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    read: { type: Boolean, default: false },
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

export const PriceAlertModel =
  models.PriceAlert ?? model<PriceAlertDocument>("PriceAlert", PriceAlertSchema);

export const AppNotificationModel =
  models.AppNotification ?? model<AppNotificationDocument>("AppNotification", AppNotificationSchema);

export function toPriceAlert(doc: PriceAlertDocument & { _id: unknown }): PriceAlert {
  return {
    id: doc._id?.toString() ?? "",
    userId: doc.userId,
    productId: doc.productId,
    targetPrice: doc.targetPrice ?? null,
    conditions: doc.conditions ?? [],
    channels: doc.channels ?? [],
    status: doc.status,
    triggeredAt: doc.triggeredAt ?? null,
    createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}