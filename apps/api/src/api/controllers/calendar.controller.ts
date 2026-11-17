import type { Request, Response } from "express";
import { asyncHandler, ok, created } from "@/utils/async-handler";
import * as calendarService from "@/application/services/calendar.service";
import type {
  CreateCalendarEventSchemaInput,
  UpdateCalendarEventSchemaInput,
} from "@/api/validators/calendar.schema";

/** POST /calendar — create a new calendar event */
export const createCalendarEventController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as CreateCalendarEventSchemaInput;
    const event = await calendarService.createEvent({
      userId: req.user!.id,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      location: input.location,
      eventCategory: input.eventCategory,
      dressCode: input.dressCode,
      reminderDays: input.reminderDays,
    });
    created(res, { event });
  },
);

/** GET /calendar — list all events for the current user */
export const listCalendarEventsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { start, end } = req.query;
    let events;
    if (start && end) {
      events = await calendarService.getEventsByDateRange(
        req.user!.id,
        start as string,
        end as string,
      );
    } else {
      events = await calendarService.getEvents(req.user!.id);
    }
    ok(res, { events });
  },
);

/** GET /calendar/:id — get a single event */
export const getCalendarEventController = asyncHandler(
  async (req: Request, res: Response) => {
    const event = await calendarService.getEvent(req.user!.id, req.params.id);
    ok(res, { event });
  },
);

/** PATCH /calendar/:id — update an event */
export const updateCalendarEventController = asyncHandler(
  async (req: Request, res: Response) => {
    const patch = req.body as UpdateCalendarEventSchemaInput;
    const event = await calendarService.updateEvent(req.user!.id, req.params.id, patch);
    ok(res, { event });
  },
);

/** DELETE /calendar/:id — delete an event */
export const deleteCalendarEventController = asyncHandler(
  async (req: Request, res: Response) => {
    await calendarService.deleteEvent(req.user!.id, req.params.id);
    ok(res, { deleted: true });
  },
);
