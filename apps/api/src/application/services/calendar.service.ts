import { calendarRepository } from "@/infrastructure/repos/calendar.repo";
import type { CreateCalendarEventInput } from "@/domain/ports/repositories";
import type { CalendarEvent } from "@stylaiize/shared";
import { NotFoundError } from "@/utils/errors";

export async function createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
  return calendarRepository().create(input);
}

export async function getEvents(userId: string): Promise<CalendarEvent[]> {
  return calendarRepository().findByUserId(userId);
}

export async function getEventsByDateRange(
  userId: string,
  start: string,
  end: string,
): Promise<CalendarEvent[]> {
  return calendarRepository().findByUserIdAndDateRange(userId, start, end);
}

export async function getEvent(userId: string, eventId: string): Promise<CalendarEvent> {
  const event = await calendarRepository().findById(eventId);
  if (!event || event.userId !== userId) throw new NotFoundError("Event not found.");
  return event;
}

export async function updateEvent(
  userId: string,
  eventId: string,
  patch: Partial<Pick<CalendarEvent, "title" | "startsAt" | "endsAt" | "location" | "eventCategory" | "dressCode" | "isOutfitPlanned" | "reminderDays">>,
): Promise<CalendarEvent> {
  const existing = await calendarRepository().findById(eventId);
  if (!existing || existing.userId !== userId) throw new NotFoundError("Event not found.");
  const updated = await calendarRepository().update(eventId, patch);
  return updated!;
}

export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const existing = await calendarRepository().findById(eventId);
  if (!existing || existing.userId !== userId) throw new NotFoundError("Event not found.");
  await calendarRepository().delete(eventId);
}
