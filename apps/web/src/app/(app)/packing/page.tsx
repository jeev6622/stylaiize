"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Loader2,
  Luggage,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
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
  PACKING_CATEGORIES,
  type PackingList,
  type PackingItem,
  type PackingCategory,
} from "@stylaiize/shared";

const CATEGORY_LABELS: Record<PackingCategory, string> = {
  clothing: "Clothing",
  shoes: "Shoes",
  accessories: "Accessories",
  toiletries: "Toiletries",
  tech: "Tech",
  documents: "Documents",
  misc: "Miscellaneous",
};

const CATEGORY_ICONS: Record<PackingCategory, string> = {
  clothing: "👕",
  shoes: "👟",
  accessories: "💍",
  toiletries: "🧴",
  tech: "💻",
  documents: "📄",
  misc: "📦",
};

interface TripFormData {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: TripFormData = {
  title: "",
  destination: "",
  startDate: "",
  endDate: "",
};

export default function PackingPage() {
  const { user } = useAuth();
  const [lists, setLists] = useState<PackingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedList, setSelectedList] = useState<PackingList | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState<TripFormData>(EMPTY_FORM);
  const [activities, setActivities] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const loadLists = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ lists: PackingList[] }>(API_ENDPOINTS.packing);
      setLists(res.lists);
    } catch {
      toast.error("Failed to load packing lists.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  async function handleGenerate() {
    if (!form.destination.trim()) {
      toast.error("Destination is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ list: PackingList }>(
        `${API_ENDPOINTS.packing}/generate`,
        {
          destination: form.destination.trim(),
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          activities: activities
            ? activities.split(",").map((a) => a.trim()).filter(Boolean)
            : [],
        },
      );
      toast.success("Packing list generated!");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setActivities("");
      setSelectedList(res.list);
      void loadLists();
    } catch {
      toast.error("Failed to generate packing list.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.destination.trim()) {
      toast.error("Title and destination are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ list: PackingList }>(API_ENDPOINTS.packing, {
        title: form.title.trim(),
        destination: form.destination.trim(),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      });
      toast.success("Trip created!");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setActivities("");
      setSelectedList(res.list);
      void loadLists();
    } catch {
      toast.error("Failed to create trip.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`${API_ENDPOINTS.packing}/${id}`);
      setDeleteConfirmId(null);
      if (selectedList?.id === id) setSelectedList(null);
      toast.success("Trip deleted.");
      void loadLists();
    } catch {
      toast.error("Failed to delete trip.");
    }
  }

  async function handleTogglePacked(listId: string, itemId: string) {
    const list = lists.find((l) => l.id === listId) ?? selectedList;
    if (!list) return;

    const target = list.items.find((item) => item.id === itemId);
    if (!target) return;

    const newPacked = !target.packed;

    const updatedItems = list.items.map((item) =>
      item.id === itemId ? { ...item, packed: newPacked } : item,
    );

    try {
      const res = await apiClient.patch<{ list: PackingList }>(
        `${API_ENDPOINTS.packing}/${listId}`,
        { items: updatedItems },
      );
      setSelectedList(res.list);
      setLists((prev) => prev.map((l) => (l.id === listId ? res.list : l)));
      toast.success(newPacked ? "Marked as packed." : "Marked as unpacked.");
    } catch {
      toast.error("Failed to update item.");
    }
  }

  function getProgress(list: PackingList): number {
    if (list.items.length === 0) return 0;
    const packed = list.items.filter((item) => item.packed).length;
    return Math.round((packed / list.items.length) * 100);
  }

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  const groupedItems = useMemo(() => {
    if (!selectedList) return {};
    const groups: Record<string, PackingItem[]> = {};
    for (const cat of PACKING_CATEGORIES) {
      const items = selectedList.items.filter((i) => i.category === cat);
      if (items.length > 0) groups[cat] = items;
    }
    return groups;
  }, [selectedList]);

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
          <h1 className="text-xl font-bold">Packing Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Plan what to pack for your trips
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(EMPTY_FORM);
            setActivities("");
            setDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Trip
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Trip History Sidebar */}
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto">
          <div className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              Your Trips
            </h3>
            {lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No trips yet. Create your first trip!
              </p>
            ) : (
              <div className="space-y-2">
                {lists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setSelectedList(list)}
                    className={cn(
                      "w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-secondary",
                      selectedList?.id === list.id && "border-primary bg-primary/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{list.title}</p>
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {list.destination}
                        </div>
                        {list.startDate && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(list.startDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                            {list.endDate &&
                              ` - ${new Date(list.endDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}`}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {list.items.length} items
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(list.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedList ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4">
                <Luggage className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Select a trip</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Choose a trip from the sidebar or create a new one to get started.
              </p>
              <Button
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setActivities("");
                  setDialogOpen(true);
                }}
                className="mt-4 gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate Packing List with AI
              </Button>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl">
              {/* Trip Header */}
              <div className="mb-6">
                <h2 className="text-xl font-bold">{selectedList.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {selectedList.destination}
                  </span>
                  {selectedList.startDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(selectedList.startDate).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {selectedList.endDate &&
                        ` - ${new Date(selectedList.endDate).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div className="mb-6 rounded-xl border border-border bg-card/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Packing Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {selectedList.items.filter((i) => i.packed).length} / {selectedList.items.length} items
                  </span>
                </div>
                <Progress value={getProgress(selectedList)} className="h-2" />
              </div>

              {/* Weather Adjustments */}
              {selectedList.weatherBasedAdjustments.length > 0 && (
                <div className="mb-6 rounded-xl border border-border bg-card/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Weather Adjustments</h3>
                  </div>
                  <ul className="space-y-1">
                    {selectedList.weatherBasedAdjustments.map((adj, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {adj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Items by Category */}
              <div className="space-y-3">
                {PACKING_CATEGORIES.map((cat) => {
                  const items = groupedItems[cat];
                  if (!items || items.length === 0) return null;
                  const isExpanded = expandedCategories[cat] !== false;
                  const packedCount = items.filter((i) => i.packed).length;

                  return (
                    <motion.div
                      key={cat}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-border bg-card/50"
                    >
                      <button
                        onClick={() => toggleCategory(cat)}
                        className="flex w-full items-center justify-between p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
                          <div className="text-left">
                            <p className="text-sm font-medium">{CATEGORY_LABELS[cat]}</p>
                            <p className="text-xs text-muted-foreground">
                              {packedCount} / {items.length} packed
                            </p>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-border px-4 py-2">
                              {items.map((item) => {
                                const isPacked = item.packed;
                                return (
                                  <div
                                    key={item.id}
                                    className={cn(
                                      "flex items-center gap-3 py-2",
                                      isPacked && "opacity-50",
                                    )}
                                  >
                                    <button
                                      onClick={() =>
                                        void handleTogglePacked(selectedList.id, item.id)
                                      }
                                      className={cn(
                                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                                        isPacked
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border",
                                      )}
                                    >
                                      {isPacked && <Check className="h-3 w-3" />}
                                    </button>
                                    <span
                                      className={cn(
                                        "flex-1 text-sm",
                                        isPacked && "line-through",
                                      )}
                                    >
                                      {item.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      x{item.quantity}
                                    </span>
                                    {item.essential && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        Essential
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>

              {selectedList.items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-muted-foreground">
                    No items in this packing list yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Trip Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Trip</DialogTitle>
            <DialogDescription>
              Create a new trip and optionally generate a packing list with AI.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="destination">Destination *</Label>
              <Input
                id="destination"
                placeholder="e.g. Goa, Paris, Tokyo"
                value={form.destination}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, destination: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="activities">Activities (comma-separated)</Label>
              <Textarea
                id="activities"
                placeholder="e.g. beach, hiking, dinner, sightseeing"
                value={activities}
                onChange={(e) => setActivities(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Helps AI generate a more tailored packing list
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCreate} disabled={isSubmitting}>
              Create Empty List
            </Button>
            <Button onClick={() => void handleGenerate()} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate with AI
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
            <DialogTitle>Delete Trip</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this trip and its packing list? This action cannot be undone.
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
