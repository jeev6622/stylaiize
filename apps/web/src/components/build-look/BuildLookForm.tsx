"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StyleSelector } from "./StyleSelector";
import { BudgetSelector } from "./BudgetSelector";
import { BUILD_LOOK_AUDIENCES, type BuildLookAudience } from "@stylaiize/shared";
import { cn } from "@/lib/utils";
import type { BudgetLevel, StyleType } from "./types";

export interface BuildLookFormState {
  audience: BuildLookAudience | "";
  eventName: string;
  occasion: string;
  dressCode: string;
  style: StyleType;
  budget: BudgetLevel;
  colors: string;
  fit: string;
  brand: string;
  season: string;
  includeGrooming: boolean;
}

export const EMPTY_BUILD_LOOK_FORM: BuildLookFormState = {
  audience: "",
  eventName: "",
  occasion: "",
  dressCode: "",
  style: "modern",
  budget: "10000",
  colors: "",
  fit: "",
  brand: "",
  season: "",
  includeGrooming: true,
};

interface BuildLookFormProps {
  value: BuildLookFormState;
  onChange: (next: BuildLookFormState) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}

export function BuildLookForm({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  error,
}: BuildLookFormProps) {
  const set = <K extends keyof BuildLookFormState>(key: K, val: BuildLookFormState[K]) =>
    onChange({ ...value, [key]: val });

  const canSubmit =
    value.audience !== "" && value.eventName.trim().length >= 2 && !isSubmitting;

  return (
    <div className="glass space-y-6 rounded-2xl border border-border/50 p-6 backdrop-blur-xl">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">Tell us about the event</h2>
        <p className="text-sm text-muted-foreground">
          The more detail you give, the better the AI can build your look. Required fields are
          marked.
        </p>
      </div>

      <div className="space-y-2">
        <Label>
          Who is this look for? <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {BUILD_LOOK_AUDIENCES.map((audience) => (
            <button
              key={audience}
              type="button"
              onClick={() => set("audience", audience)}
              className={cn(
                "rounded-lg border px-2 py-2 text-xs font-medium capitalize transition-colors",
                value.audience === audience
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-secondary/20 text-muted-foreground hover:text-foreground",
              )}
            >
              {audience}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventName">
          Event name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="eventName"
          value={value.eventName}
          onChange={(e) => set("eventName", e.target.value)}
          placeholder="e.g. Priya's Engagement"
          maxLength={120}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="occasion">Occasion type</Label>
          <Input
            id="occasion"
            value={value.occasion}
            onChange={(e) => set("occasion", e.target.value)}
            placeholder="Wedding, interview, date night..."
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dressCode">Dress code</Label>
          <Input
            id="dressCode"
            value={value.dressCode}
            onChange={(e) => set("dressCode", e.target.value)}
            placeholder="Smart casual, black tie..."
            maxLength={120}
          />
        </div>
      </div>

      <StyleSelector selected={value.style} onSelect={(s) => set("style", s)} />
      <BudgetSelector selected={value.budget} onSelect={(b) => set("budget", b)} />

      <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
        <div className="space-y-0.5">
          <Label htmlFor="includeGrooming" className="cursor-pointer text-sm font-medium">
            Include grooming ideas
          </Label>
          <p className="text-xs text-muted-foreground">
            Hair, facial grooming, skin prep, accessories and fragrance matched to
            this look.
          </p>
        </div>
        <Switch
          id="includeGrooming"
          checked={value.includeGrooming}
          onCheckedChange={(checked) => set("includeGrooming", checked)}
          aria-label="Include grooming ideas"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="colors">Preferred colours</Label>
        <Input
          id="colors"
          value={value.colors}
          onChange={(e) => set("colors", e.target.value)}
          placeholder="e.g. navy, white, maroon"
          maxLength={240}
        />
        <p className="text-xs text-muted-foreground">Separate multiple colours with commas.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="fit">Fit preference</Label>
          <Input
            id="fit"
            value={value.fit}
            onChange={(e) => set("fit", e.target.value)}
            placeholder="Slim, relaxed..."
            maxLength={60}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand">Preferred brand</Label>
          <Input
            id="brand"
            value={value.brand}
            onChange={(e) => set("brand", e.target.value)}
            placeholder="Optional"
            maxLength={60}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="season">Season</Label>
          <Input
            id="season"
            value={value.season}
            onChange={(e) => set("season", e.target.value)}
            placeholder="e.g. winter"
            maxLength={60}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button className="w-full gap-2" size="lg" disabled={!canSubmit} onClick={onSubmit}>
        <Sparkles className="h-4 w-4" />
        {isSubmitting ? "Building your look..." : "Build My Look"}
      </Button>
    </div>
  );
}
