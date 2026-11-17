"use client";

import { useEffect, useRef, useState } from "react";
import {
  BODY_BUILDS,
  FACE_SHAPES,
  HAIR_LENGTHS,
  HAIR_TYPES,
  SKIN_UNDERTONES,
  type StyleProfile,
} from "@stylaiize/shared";
import { API_ENDPOINTS } from "@stylaiize/shared";
import { Camera, Check, Info, Loader2, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface StyleProfileCardProps {
  profile: StyleProfile | null;
  onChange: (profile: StyleProfile | null) => void;
}

function analysisErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "AI_NOT_CONFIGURED") {
      return "Photo analysis is not available right now. Skip this step and your look will still be built from the details below.";
    }
    if (err.status === 415) {
      return "That image type is not supported. Please use a JPEG, PNG or WebP photo.";
    }
    if (err.status === 413) {
      return "That photo is too large. Try a smaller image.";
    }
    return err.message || "Could not analyse the photo. Please try again.";
  }
  return err instanceof Error && err.message
    ? err.message
    : "Could not analyse the photo. Please try again.";
}

function ProfileChipRow({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: readonly string[];
  selected?: string;
  onSelect: (value: string | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {values.map((value) => {
          const isActive = selected === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(isActive ? undefined : value)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "border-cyan-400/60 bg-cyan-500/15 text-foreground"
                  : "border-border bg-secondary/30 text-muted-foreground hover:border-cyan-500/40 hover:text-foreground",
              )}
            >
              {isActive && <Check className="h-3 w-3 text-cyan-400" />}
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Optional photo step. The image is sent once for analysis and is never
 * persisted by this component; only the reviewed profile is passed upward.
 */
export function StyleProfileCard({ profile, onChange }: StyleProfileCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectFile(next: File | null) {
    if (!next) return;
    setSaved(false);
    setError(null);
    if (!ALLOWED_TYPES.includes(next.type)) {
      setError("Please choose a JPEG, PNG or WebP photo.");
      return;
    }
    if (next.size > MAX_PHOTO_BYTES) {
      setError("That photo is too large. Choose one under 8 MB.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  function updateProfile(patch: Partial<StyleProfile>) {
    if (!profile) return;
    setSaved(false);
    setError(null);
    onChange({ ...profile, ...patch, userEdited: true });
  }

  async function handleAnalyze() {
    if (!file) {
      setError("Choose a photo first, or skip this step.");
      return;
    }
    if (!consent) {
      setError("Please confirm you are happy for the photo to be analysed.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await apiClient.post<{ styleProfile: StyleProfile }>(
        API_ENDPOINTS.styleProfile.analyze,
        body,
        { timeoutMs: 90_000 },
      );
      onChange({ ...res.styleProfile, userEdited: false });
      setSaved(false);
    } catch (err) {
      setError(analysisErrorMessage(err));
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleSaveProfile() {
    if (!profile || isSaving) return;
    void (async () => {
      setIsSaving(true);
      setError(null);
      try {
        await apiClient.put(API_ENDPOINTS.memoryStyleProfile, {
          styleProfile: { ...profile, userEdited: true },
        });
        setSaved(true);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not save your style profile. It will still be used for this look.",
        );
      } finally {
        setIsSaving(false);
      }
    })();
  }

  function handleSkip() {
    onChange(null);
    setFile(null);
    setConsent(false);
    setError(null);
    setSaved(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  return (
    <div className="glass space-y-5 rounded-2xl border border-border/50 p-6 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            Optional: personalise with a photo
          </h2>
          <p className="text-sm text-muted-foreground">
            Add a clear photo to refine colours and grooming. You can skip this
            and still build a look.
          </p>
        </div>
        {profile && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={handleSkip}
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>

      {!profile && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-secondary/20 sm:w-40 sm:shrink-0">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Selected style-profile photo preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="px-4 text-center">
                  <Camera className="mx-auto mb-2 h-7 w-7 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">No photo selected</p>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload photo
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  Take photo
                </Button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept={ALLOWED_TYPES.join(",")}
                  className="sr-only"
                  aria-label="Upload a style-profile photo"
                  onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept={ALLOWED_TYPES.join(",")}
                  capture="user"
                  className="sr-only"
                  aria-label="Take a style-profile photo"
                  onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 accent-cyan-500"
                />
                <span>
                  I agree to have this photo analysed for styling suggestions. It
                  is used once for this request and is not saved.
                </span>
              </label>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  disabled={!file || !consent || isAnalyzing}
                  onClick={() => void handleAnalyze()}
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isAnalyzing ? "Analysing..." : "Analyse photo"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isAnalyzing}
                  onClick={handleSkip}
                >
                  Skip
                </Button>
              </div>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-xl bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>
              We only look at styling cues (colours, face shape, hair, general
              build). We do not infer age, gender, ethnicity, religion, health or
              identity. Photos are never written to disk or logged.
            </span>
          </p>
        </>
      )}

      {isAnalyzing && (
        <div className="space-y-2" aria-hidden="true">
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-secondary" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-secondary" />
          <div className="h-8 w-full animate-pulse rounded-xl bg-secondary" />
        </div>
      )}

      {profile && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-3.5 w-3.5 text-cyan-400" />
            Review and correct anything that does not look right.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileChipRow
              label="Face shape"
              values={FACE_SHAPES}
              selected={profile.faceShape}
              onSelect={(value) =>
                updateProfile({ faceShape: value as StyleProfile["faceShape"] })
              }
            />
            <ProfileChipRow
              label="Hair type"
              values={HAIR_TYPES}
              selected={profile.hairType}
              onSelect={(value) =>
                updateProfile({ hairType: value as StyleProfile["hairType"] })
              }
            />
            <ProfileChipRow
              label="Hair length"
              values={HAIR_LENGTHS}
              selected={profile.hairLength}
              onSelect={(value) =>
                updateProfile({ hairLength: value as StyleProfile["hairLength"] })
              }
            />
            <ProfileChipRow
              label="Undertone"
              values={SKIN_UNDERTONES}
              selected={profile.undertone}
              onSelect={(value) =>
                updateProfile({ undertone: value as StyleProfile["undertone"] })
              }
            />
            <ProfileChipRow
              label="Build"
              values={BODY_BUILDS}
              selected={profile.bodyBuild}
              onSelect={(value) =>
                updateProfile({ bodyBuild: value as StyleProfile["bodyBuild"] })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paletteSuggestions">Suggested colours</Label>
            <Input
              id="paletteSuggestions"
              value={profile.paletteSuggestions.join(", ")}
              onChange={(e) =>
                updateProfile({
                  paletteSuggestions: e.target.value
                    .split(",")
                    .map((c) => c.trim())
                    .filter(Boolean)
                    .slice(0, 8),
                })
              }
              placeholder="e.g. olive, camel, navy"
            />
            <p className="text-xs text-muted-foreground">
              Separate colours with commas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={isSaving}
              onClick={handleSaveProfile}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {isSaving
                ? "Saving..."
                : saved
                  ? "Saved to your profile"
                  : "Save to my profile"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleSkip}>
              Don&apos;t use a profile
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            The photo is not saved. Your edits stay in this browser session unless
            you tap Save to my profile.
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
