import { randomUUID } from "node:crypto";
import type { CalendarEvent } from "@stylaiize/shared";
import type {
  CalendarRepository,
  CreateCalendarEventInput,
} from "@/domain/ports/repositories";

/**
 * In-memory calendar repository for demo mode (no MongoDB configured).
 * Data is intentionally not persisted across restarts.
 */
export class InMemoryCalendarRepository implements CalendarRepository {
  private readonly events = new Map<string, CalendarEvent>();

  async create(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    const event: CalendarEvent = {
      id: randomUUID(),
      userId: input.userId,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      location: input.location ?? null,
      eventCategory: input.eventCategory ?? null,
      dressCode: input.dressCode ?? null,
      isOutfitPlanned: false,
      reminderDays: input.reminderDays ?? [],
    };
    this.events.set(event.id, structuredClone(event));
    return structuredClone(event);
  }

  async findById(id: string): Promise<CalendarEvent | null> {
    const event = this.events.get(id);
    return event ? structuredClone(event) : null;
  }

  async findByUserId(userId: string): Promise<CalendarEvent[]> {
    const results: CalendarEvent[] = [];
    for (const event of this.events.values()) {
      if (event.userId === userId) results.push(structuredClone(event));
    }
    return results.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }

  async findByUserIdAndDateRange(
    userId: string,
    start: string,
    end: string,
  ): Promise<CalendarEvent[]> {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const results: CalendarEvent[] = [];
    for (const event of this.events.values()) {
      if (
        event.userId === userId &&
        new Date(event.startsAt).getTime() >= startTime &&
        new Date(event.startsAt).getTime() <= endTime
      ) {
        results.push(structuredClone(event));
      }
    }
    return results.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }

  async update(
    id: string,
    patch: Partial<Pick<CalendarEvent, "title" | "startsAt" | "endsAt" | "location" | "eventCategory" | "dressCode" | "isOutfitPlanned" | "reminderDays">>,
  ): Promise<CalendarEvent | null> {
    const existing = this.events.get(id);
    if (!existing) return null;
    const updated: CalendarEvent = {
      ...existing,
      ...patch,
    };
    this.events.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async delete(id: string): Promise<void> {
    this.events.delete(id);
  }
}
