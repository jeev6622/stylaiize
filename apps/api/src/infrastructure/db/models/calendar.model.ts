import { Schema, model, models } from "mongoose";
import type { CalendarEvent, EventCategory } from "@stylaiize/shared";

export interface CalendarEventDocument {
  userId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  eventCategory: EventCategory | null;
  dressCode: string | null;
  isOutfitPlanned: boolean;
  reminderDays: number[];
  createdAt: Date;
  updatedAt: Date;
}

const CalendarEventSchema = new Schema<CalendarEventDocument>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    startsAt: { type: String, required: true },
    endsAt: { type: String, required: true },
    location: { type: String, default: null, trim: true },
    eventCategory: { type: String, default: null },
    dressCode: { type: String, default: null, trim: true },
    isOutfitPlanned: { type: Boolean, default: false },
    reminderDays: { type: [Number], default: [] },
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

export const CalendarEventModel =
  models.CalendarEvent ?? model<CalendarEventDocument>("CalendarEvent", CalendarEventSchema);

export function toCalendarEvent(doc: CalendarEventDocument & { _id: unknown }): CalendarEvent {
  return {
    id: doc._id?.toString() ?? "",
    userId: doc.userId,
    title: doc.title,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    location: doc.location ?? null,
    eventCategory: doc.eventCategory ?? null,
    dressCode: doc.dressCode ?? null,
    isOutfitPlanned: doc.isOutfitPlanned ?? false,
    reminderDays: doc.reminderDays ?? [],
  };
}
