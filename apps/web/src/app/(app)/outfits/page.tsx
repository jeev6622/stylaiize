"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles,
  Calendar,
  MapPin,
  DollarSign,
  Shirt,
  Loader2,
  Wand2,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";
import {
  API_ENDPOINTS,
  OCCASION_PRESETS,
  type Outfit,
  type OutfitCategory,
  type EventCategory,
} from "@stylaiize/shared";

const CATEGORY_LABELS: Record<OutfitCategory, string> = {
  casual: "Casual",
  smart_casual: "Smart Casual",
  formal: "Formal",
  business: "Business",
  party: "Party",
  ethnic: "Ethnic",
  beach: "Beach",
  sport: "Sport",
  travel: "Travel",
};

const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
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

interface FormData {
  name: string;
  category: EventCategory;
  date: string;
  venue: string;
  dressCode: string;
  theme: string;
  indoorOutdoor: "indoor" | "outdoor" | "unknown";
  notes: string;
}

const EMPTY_FORM: FormData = {
  name: "",
  category: "other",
  date: "",
  venue: "",
  dressCode: "",
  theme: "",
  indoorOutdoor: "unknown",
  notes: "",
};

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export default function OutfitsPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [hasResults, setHasResults] = useState(false);

  const handlePreset = useCallback((preset: (typeof OCCASION_PRESETS)[number]) => {
    setForm((prev) => ({
      ...prev,
      name: preset.label,
      category: preset.value as EventCategory,
    }));
  }, []);

  async function handleGetRecommendations() {
    if (!form.name.trim()) {
      toast.error("Event name is required.");
      return;
    }

    setIsLoading(true);
    setOutfits([]);
    setSummary(null);

    try {
      const payload = {
        event: {
          name: form.name.trim(),
          category: form.category,
          date: form.date || null,
          time: null,
          venue: form.venue || null,
          dressCode: form.dressCode || null,
          theme: form.theme || null,
          indoorOutdoor: form.indoorOutdoor,
          notes: form.notes || null,
        },
      };

      const result = await apiClient.post<{
        outfits: Outfit[];
        analysis: unknown;
        summary: string;
      }>(API_ENDPOINTS.recommend, payload);

      setOutfits(result.outfits);
      setSummary(result.summary);
      setHasResults(true);

      if (result.outfits.length === 0) {
        toast.info("No outfits generated. Try adjusting your event details.");
      }
    } catch {
      toast.error("Failed to get recommendations. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveOutfit(outfit: Outfit) {
    try {
      await apiClient.post(API_ENDPOINTS.savedOutfits, {
        name: outfit.name,
        category: outfit.category,
        occasion: form.name || null,
        style: form.theme || null,
        colors: [...new Set(outfit.items.map((i) => i.color))],
        budget: outfit.totalCost,
        items: outfit.items,
        scores: outfit.scores,
        totalCost: outfit.totalCost,
        explanation: outfit.explanation,
        source: "ai",
      });
      toast.success(`Saved “${outfit.name}” to your collection.`);
    } catch {
      toast.error("Failed to save outfit.");
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Outfit Ideas</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered outfit recommendations for your event
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Preset Chips (shown when no results) */}
          {!hasResults && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Quick start — pick an occasion:
              </p>
              <div className="flex flex-wrap gap-2">
                {OCCASION_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handlePreset(preset)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-xs font-medium transition-colors",
                      form.category === preset.value && form.name === preset.label
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Event Form */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card/50 p-6"
          >
            <h2 className="mb-4 text-sm font-semibold">Event Details</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="eventName">Event Name *</Label>
                <Input
                  id="eventName"
                  placeholder="e.g. Best friend's wedding"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Event Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) =>
                    setForm((prev) => ({ ...prev, category: val as EventCategory }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="date"
                    type="date"
                    className="pl-9"
                    value={form.date}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="venue"
                    placeholder="e.g. Grand Hyatt, Mumbai"
                    className="pl-9"
                    value={form.venue}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, venue: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dressCode">Dress Code</Label>
                <div className="relative">
                  <Shirt className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="dressCode"
                    placeholder="e.g. Black tie, Semi-formal"
                    className="pl-9"
                    value={form.dressCode}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dressCode: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Input
                  id="theme"
                  placeholder="e.g. Rustic, Bohemian"
                  value={form.theme}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, theme: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Setting</Label>
                <div className="flex gap-2">
                  {(["indoor", "outdoor", "unknown"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, indoorOutdoor: opt }))
                      }
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors",
                        form.indoorOutdoor === opt
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {opt === "unknown" ? "Any" : opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional details... (colors to avoid, comfort preferences, etc.)"
                  rows={3}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
            </div>

            <Button
              onClick={() => void handleGetRecommendations()}
              disabled={isLoading || !form.name.trim()}
              className="mt-4 w-full gap-2"
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {isLoading ? "Generating outfits..." : "Get Recommendations"}
            </Button>
          </motion.div>

          {/* Results */}
          {hasResults && (
            <div className="space-y-6">
              {/* Summary */}
              {summary && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border bg-card/50 p-4"
                >
                  <p className="text-sm text-muted-foreground">{summary}</p>
                </motion.div>
              )}

              {/* Outfit Grid */}
              {outfits.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {outfits.map((outfit, index) => (
                    <motion.div
                      key={outfit.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                      className="rounded-2xl border border-border bg-card/50 p-5"
                    >
                      {/* Header */}
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold">{outfit.name}</h3>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {CATEGORY_LABELS[outfit.category]}
                        </Badge>
                      </div>

                      {/* Score Bars */}
                      <div className="mb-4 space-y-2">
                        <ScoreBar
                          label="Fashion"
                          score={outfit.scores.fashion}
                          color="bg-violet-500"
                        />
                        <ScoreBar
                          label="Event Match"
                          score={outfit.scores.eventMatch}
                          color="bg-blue-500"
                        />
                        <ScoreBar
                          label="Comfort"
                          score={outfit.scores.comfort}
                          color="bg-green-500"
                        />
                        <ScoreBar
                          label="Budget"
                          score={outfit.scores.budget}
                          color="bg-amber-500"
                        />
                      </div>

                      <Separator className="mb-4" />

                      {/* Items */}
                      <div className="mb-4 space-y-2">
                        {outfit.items.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 rounded-lg bg-secondary/30 px-3 py-2"
                          >
                            <span
                              className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full border border-border"
                              style={{ backgroundColor: item.color }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium">
                                  {item.name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="px-1.5 py-0 text-[10px]"
                                >
                                  {item.type}
                                </Badge>
                                {item.brand && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {item.brand}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {item.reason}
                              </p>
                            </div>
                            {item.price != null && (
                              <span className="shrink-0 text-xs font-medium text-foreground">
                                {formatCurrency(item.price)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Total Cost */}
                      <div className="mb-3 flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          Total Estimated Cost
                        </span>
                        <span className="text-sm font-bold">
                          {outfit.totalCost !== null
                            ? formatCurrency(outfit.totalCost)
                            : "N/A"}
                        </span>
                      </div>

                      {/* Explanation */}
                      <p className="mb-4 text-xs text-muted-foreground">
                        {outfit.explanation}
                      </p>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => router.push("/try-on")}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Try On
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => void handleSaveOutfit(outfit)}
                        >
                          <Bookmark className="h-3.5 w-3.5" />
                          Save
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 rounded-full bg-primary/10 p-4">
                    <Shirt className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">
                    No outfits generated
                  </h3>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Try adjusting your event details or adding more specific
                    preferences in the notes.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
