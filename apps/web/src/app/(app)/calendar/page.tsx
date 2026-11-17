"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  API_ENDPOINTS,
  EVENT_CATEGORIES,
  type CalendarEvent,
  type EventCategory,
} from "@stylaiize/shared";

const CATEGORY_LABELS: Record<EventCategory, string> = {
  wedding: "Wedding",
  job_interview: "Job Interview",
  office_meeting: "Office Meeting",
  birthday_party: "Birthday Party",
  college_farewell: "College Farewell",
  date_night: "Date Night",
  festival: "Festival",
  beach_trip: "Beach Trip",
  business_conference: "Business Conference",
  gym: "Gym",
  travel: "Travel",
  dinner: "Dinner",
  funeral: "Funeral",
  sports_match: "Sports Match",
  concert: "Concert",
  graduation: "Graduation",
  religious_ceremony: "Religious Ceremony",
  casual_outing: "Casual Outing",
  other: "Other",
};

const CATEGORY_COLORS: Record<EventCategory, string> = {
  wedding: "bg-pink-500",
  job_interview: "bg-blue-600",
  office_meeting: "bg-slate-500",
  birthday_party: "bg-yellow-500",
  college_farewell: "bg-purple-500",
  date_night: "bg-red-500",
  festival: "bg-orange-500",
  beach_trip: "bg-cyan-500",
  business_conference: "bg-indigo-600",
  gym: "bg-green-600",
  travel: "bg-teal-500",
  dinner: "bg-amber-600",
  funeral: "bg-gray-600",
  sports_match: "bg-lime-600",
  concert: "bg-fuchsia-500",
  graduation: "bg-violet-500",
  religious_ceremony: "bg-rose-500",
  casual_outing: "bg-sky-500",
  other: "bg-gray-400",
};

const DAYSOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface EventFormData {
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  eventCategory: EventCategory | "";
  dressCode: string;
  reminderDays: string;
}

const EMPTY_FORM: EventFormData = {
  title: "",
  startsAt: "",
  endsAt: "",
  location: "",
  eventCategory: "",
  dressCode: "",
  reminderDays: "",
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function formatDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<EventFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ events: CalendarEvent[] }>(API_ENDPOINTS.calendar);
      setEvents(res.events);
    } catch {
      toast.error("Failed to load calendar events.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      const key = event.startsAt.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(event);
    }
    return map;
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDate[selectedDate] ?? [];
  }, [selectedDate, eventsByDate]);

  const upcomingEvents = useMemo(() => {
    const now = new Date().toISOString();
    return events
      .filter((e) => e.startsAt >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [events]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function openCreateDialog() {
    setEditingEvent(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(event: CalendarEvent) {
    setEditingEvent(event);
    setForm({
      title: event.title,
      startsAt: formatDateTimeLocal(event.startsAt),
      endsAt: formatDateTimeLocal(event.endsAt),
      location: event.location ?? "",
      eventCategory: event.eventCategory ?? "",
      dressCode: event.dressCode ?? "",
      reminderDays: event.reminderDays.join(", "),
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingEvent(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!form.startsAt || !form.endsAt) {
      toast.error("Start and end dates are required.");
      return;
    }

    setIsSubmitting(true);
    const payload = {
      title: form.title.trim(),
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      location: form.location.trim() || null,
      eventCategory: form.eventCategory || null,
      dressCode: form.dressCode.trim() || null,
      reminderDays: form.reminderDays
        ? form.reminderDays.split(",").map((d) => parseInt(d.trim(), 10)).filter((n) => !isNaN(n))
        : [],
    };

    try {
      if (editingEvent) {
        await apiClient.patch(`${API_ENDPOINTS.calendar}/${editingEvent.id}`, payload);
        toast.success("Event updated!");
      } else {
        await apiClient.post(API_ENDPOINTS.calendar, payload);
        toast.success("Event created!");
      }
      closeDialog();
      void loadEvents();
    } catch {
      toast.error(editingEvent ? "Failed to update event." : "Failed to create event.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`${API_ENDPOINTS.calendar}/${id}`);
      setDeleteConfirmId(null);
      toast.success("Event deleted.");
      void loadEvents();
    } catch {
      toast.error("Failed to delete event.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Manage your events and plan outfits
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Event
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar Grid */}
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          {/* Month Navigation */}
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold">
              {new Date(currentYear, currentMonth).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYSOfWeek.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateKey = formatDateKey(currentYear, currentMonth, day);
              const dayEvents = eventsByDate[dateKey] ?? [];
              const isToday =
                dateKey ===
                formatDateKey(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  new Date().getDate(),
                );
              const isSelected = dateKey === selectedDate;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dateKey)}
                  className={cn(
                    "relative aspect-square rounded-lg p-1 text-sm transition-colors",
                    "hover:bg-secondary",
                    isToday && "ring-2 ring-primary",
                    isSelected && "bg-primary/10 ring-1 ring-primary",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      isToday && "bg-primary text-primary-foreground font-bold",
                    )}
                  >
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="absolute bottom-1 left-1 right-1 flex justify-center gap-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            ev.eventCategory
                              ? CATEGORY_COLORS[ev.eventCategory]
                              : "bg-primary",
                          )}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Side Panel - Selected Day Events */}
        <div className="hidden w-80 shrink-0 border-l border-border overflow-y-auto lg:block">
          <div className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              {selectedDate
                ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "Select a day"}
            </h3>
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {selectedDate ? "No events on this day." : "Click a day to see events."}
              </p>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {selectedDayEvents.map((event) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-lg border border-border bg-card/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium truncate">{event.title}</h4>
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(event.startsAt).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {" - "}
                            {new Date(event.endsAt).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                          {event.location && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {event.eventCategory && (
                              <Badge variant="secondary" className="text-[10px]">
                                {CATEGORY_LABELS[event.eventCategory]}
                              </Badge>
                            )}
                            {event.isOutfitPlanned && (
                              <Badge variant="default" className="text-[10px]">
                                Outfit Planned
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(event)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:text-destructive"
                            onClick={() => setDeleteConfirmId(event.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Events List */}
      {upcomingEvents.length > 0 && (
        <div className="border-t border-border px-6 py-4">
          <h3 className="mb-3 text-sm font-semibold">Upcoming Events</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcomingEvents.slice(0, 10).map((event) => (
              <div
                key={event.id}
                className="flex shrink-0 items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3"
              >
                <div className="text-center">
                  <p className="text-lg font-bold leading-none">
                    {new Date(event.startsAt).getDate()}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {new Date(event.startsAt).toLocaleDateString("en-US", { month: "short" })}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  <div className="flex items-center gap-2">
                    {event.eventCategory && (
                      <Badge variant="secondary" className="text-[10px]">
                        {CATEGORY_LABELS[event.eventCategory]}
                      </Badge>
                    )}
                    {event.isOutfitPlanned && (
                      <Badge variant="default" className="text-[10px]">
                        Outfit Planned
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEditDialog(event)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:text-destructive"
                    onClick={() => setDeleteConfirmId(event.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? "Edit Event" : "Add Event"}
            </DialogTitle>
            <DialogDescription>
              {editingEvent
                ? "Update the details of your event."
                : "Add a new event to your calendar."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Wedding Reception"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startsAt">Starts At *</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, startsAt: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endsAt">Ends At *</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, endsAt: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Grand Ballroom, Hotel Taj"
                value={form.location}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, location: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={form.eventCategory}
                onValueChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    eventCategory: val as EventCategory,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dressCode">Dress Code</Label>
              <Input
                id="dressCode"
                placeholder="e.g. Formal, Semi-formal, Casual"
                value={form.dressCode}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, dressCode: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reminderDays">Reminder Days (comma-separated)</Label>
              <Input
                id="reminderDays"
                placeholder="e.g. 1, 3, 7"
                value={form.reminderDays}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, reminderDays: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editingEvent ? (
                "Update"
              ) : (
                "Create Event"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirmId && void handleDelete(deleteConfirmId)
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
