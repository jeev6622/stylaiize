import { getDatabaseStatus } from "@/config/mongodb";
import type { CalendarEvent } from "@stylaiize/shared";
import { CalendarEventModel, toCalendarEvent } from "@/infrastructure/db/models/calendar.model";
import type {
  CalendarRepository,
  CreateCalendarEventInput,
} from "@/domain/ports/repositories";

/**
 * Mongoose-backed calendar repository.
 * Used whenever MongoDB is connected; otherwise callers use the
 * in-memory demo repository.
 */
export class MongoCalendarRepository implements CalendarRepository {
  async create(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    const doc = await CalendarEventModel.create({
      userId: input.userId,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      location: input.location ?? null,
      eventCategory: input.eventCategory ?? null,
      dressCode: input.dressCode ?? null,
      isOutfitPlanned: false,
      reminderDays: input.reminderDays ?? [],
    });
    return toCalendarEvent(doc);
  }

  async findById(id: string): Promise<CalendarEvent | null> {
    const doc = await CalendarEventModel.findById(id);
    return doc ? toCalendarEvent(doc) : null;
  }

  async findByUserId(userId: string): Promise<CalendarEvent[]> {
    const docs = await CalendarEventModel.find({ userId }).sort({ startsAt: -1 });
    return docs.map(toCalendarEvent);
  }

  async findByUserIdAndDateRange(userId: string, start: string, end: string): Promise<CalendarEvent[]> {
    const docs = await CalendarEventModel.find({
      userId,
      startsAt: { $gte: start },
      endsAt: { $lte: end },
    }).sort({ startsAt: 1 });
    return docs.map(toCalendarEvent);
  }

  async update(
    id: string,
    patch: Partial<Pick<CalendarEvent, "title" | "startsAt" | "endsAt" | "location" | "eventCategory" | "dressCode" | "isOutfitPlanned" | "reminderDays">>,
  ): Promise<CalendarEvent | null> {
    const doc = await CalendarEventModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true },
    );
    return doc ? toCalendarEvent(doc) : null;
  }

  async delete(id: string): Promise<void> {
    await CalendarEventModel.findByIdAndDelete(id);
  }
}

/** Returns the appropriate calendar repository for the current database state. */
export function calendarRepository(): CalendarRepository {
  const db = getDatabaseStatus();
  if (!db.demoMode) return mongoCalendarRepository;
  return demoCalendarRepository ?? mongoCalendarRepository;
}

let demoCalendarRepository: CalendarRepository | null = null;

export function registerDemoCalendarRepository(repo: CalendarRepository): void {
  demoCalendarRepository = repo;
}

const mongoCalendarRepository = new MongoCalendarRepository();
