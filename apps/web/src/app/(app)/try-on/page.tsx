"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  ImagePlus,
  Loader2,
  RefreshCcw,
  ScanLine,
  Shirt,
  UploadCloud,
  Trash2,
  DownloadCloud,
  Save,
  FolderPlus,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient, getAccessToken, resolveApiUrl } from "@/lib/api";
import {
  API_ENDPOINTS,
  OUTFIT_ITEM_TYPES,
  type VirtualTryOnJob,
  type VirtualTryOnJobStage,
  type VirtualTryOnResult,
  type OutfitItemType,
} from "@stylaiize/shared";

// Only the categories IDM-VTON / CatVTON can actually render.
const CATEGORY_LABELS: Partial<Record<OutfitItemType, string>> = {
  shirt: "Shirt",
  dress: "Dress",
  top: "Top",
  trousers: "Trousers",
  jeans: "Jeans",
  skirt: "Skirt",
  outerwear: "Outerwear",
};

interface TryOnStatus {
  configured: boolean;
  activeProvider: string | null;
  demoMode: boolean;
  primaryConfigured: boolean;
  fallbackConfigured: boolean;
  jobProgressSupported?: boolean;
  requestedProvider?: string;
  message?: string;
}

interface TryOnJobState {
  phase: "idle" | "running" | "success" | "error" | "needs_config";
  stage?: VirtualTryOnJobStage;
  progress?: number;
  progressSupported?: boolean;
  message?: string;
  error?: string | null;
}

const STAGE_LABELS: Record<VirtualTryOnJobStage, string> = {
  queued: "Queued",
  loading_model: "Loading IDM-VTON model",
  validating: "Validating images",
  masking: "Building garment mask",
  pose: "Detecting body pose",
  encoding: "Encoding image and text",
  diffusion: "Running diffusion",
  decoding: "Decoding generated image",
  saving: "Saving result",
  running: "Running inference",
  done: "Complete",
};

interface SaveTarget {
  id: string;
  provider: string;
  garmentLabel: string | null;
  resultImageUrl: string | null;
  category: OutfitItemType;
  createdAt: string;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Keep polling slightly longer than the API's VTON_JOB_MAX_MS (10 minutes).
const TRYON_JOB_MAX_WAIT_MS = 11 * 60 * 1000;
const TRYON_JOB_POLL_MS = 1_500;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TryOnPage() {
  const [status, setStatus] = useState<TryOnStatus | null>(null);
  const [checking, setChecking] = useState(true);

  const [personImage, setPersonImage] = useState<string | null>(null);
  const [garmentImage, setGarmentImage] = useState<string | null>(null);
  const [category, setCategory] = useState<OutfitItemType>("shirt");
  const [garmentLabel, setGarmentLabel] = useState("");

  const [job, setJob] = useState<TryOnJobState>({ phase: "idle" });
  const [result, setResult] = useState<VirtualTryOnResult | null>(null);

  const [history, setHistory] = useState<SaveTarget[]>([]);
  const [saveDialog, setSaveDialog] = useState<"outfit" | "wardrobe" | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");

  const personInputRef = useRef<HTMLInputElement>(null);
  const garmentInputRef = useRef<HTMLInputElement>(null);
  const runTokenRef = useRef(0);

  useEffect(() => {
    apiClient
      .get<TryOnStatus>(API_ENDPOINTS.tryonStatus)
      .then(setStatus)
      .catch(() =>
        setStatus({
          configured: false,
          activeProvider: null,
          demoMode: false,
          primaryConfigured: false,
          fallbackConfigured: false,
        }),
      )
      .finally(() => setChecking(false));
  }, []);

  // Allow deep links like /try-on?garment=Navy+blazer (e.g. from a saved
  // outfit) to prefill the garment label.
  useEffect(() => {
    const garment = new URLSearchParams(window.location.search).get("garment");
    if (garment?.trim()) {
      setGarmentLabel(garment.trim());
    }
  }, []);

  useEffect(() => {
    apiClient
      .get<{ results: SaveTarget[] }>(API_ENDPOINTS.tryonResults)
      .then((d) => setHistory(d.results))
      .catch(() => {});
  }, []);

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Unsupported image type. Use JPEG, PNG, or WebP.";
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return "Image must be under 8MB.";
    }
    return null;
  }

  async function handleFile(
    setter: (v: string) => void,
    file?: File,
  ): Promise<void> {
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setter(dataUrl);
  }

  function applyJob(job: VirtualTryOnJob) {
    setJob({
      phase: job.status === "queued" || job.status === "running" ? "running" : "error",
      stage: job.stage,
      progress: job.progress,
      progressSupported: job.progressSupported,
      message: job.message,
      error: job.error ?? null,
    });
  }

  async function handleRunTryOn() {
    if (!personImage || !garmentImage) {
      toast.error("Please provide both a person photo and a garment photo.");
      return;
    }

    const runToken = ++runTokenRef.current;
    setJob({
      phase: "running",
      stage: "queued",
      progress: 0,
      progressSupported: true,
      message: "Submitting try-on job...",
    });
    setResult(null);

    try {
      let current = await apiClient.post<VirtualTryOnJob>(
        API_ENDPOINTS.tryonJobs,
        {
          personImage,
          garmentImage,
          category,
          ...(garmentLabel.trim() ? { garmentLabel: garmentLabel.trim() } : {}),
        },
        { timeoutMs: 30_000 },
      );
      if (runTokenRef.current !== runToken) return;
      applyJob(current);

      if (current.status === "not_configured") {
        setJob({
          phase: "needs_config",
          stage: current.stage,
          progress: 0,
          progressSupported: false,
          message: current.message,
        });
        return;
      }

      const deadline = Date.now() + TRYON_JOB_MAX_WAIT_MS;
      while (current.status === "queued" || current.status === "running") {
        if (Date.now() >= deadline) {
          throw new Error(
            "The try-on job is taking too long. Check the GPU service logs.",
          );
        }
        await new Promise((resolve) =>
          setTimeout(resolve, TRYON_JOB_POLL_MS),
        );
        if (runTokenRef.current !== runToken) return;

        current = await apiClient.get<VirtualTryOnJob>(
          `${API_ENDPOINTS.tryonJobs}/${encodeURIComponent(current.id)}`,
        );
        if (runTokenRef.current !== runToken) return;
        applyJob(current);
      }

      if (current.status === "succeeded") {
        if (!current.resultId || !current.resultImageUrl || !current.provider) {
          throw new Error("The try-on service completed without a usable result.");
        }
        const completed: VirtualTryOnResult = {
          configured: true,
          resultImageUrl: current.resultImageUrl,
          resultId: current.resultId,
          provider: current.provider,
          demoMode: false,
          processingTimeMs: current.processingTimeMs ?? null,
          status: "success",
        };
        setResult(completed);
        setJob({
          phase: "success",
          stage: "done",
          progress: 100,
          progressSupported: current.progressSupported,
          message: current.message,
        });
        refreshHistory();
      } else if (current.status === "not_configured") {
        setJob({
          phase: "needs_config",
          stage: current.stage,
          progress: 0,
          progressSupported: false,
          message: current.message,
        });
      } else {
        setJob({
          phase: "error",
          stage: current.stage,
          progress: current.progress,
          progressSupported: current.progressSupported,
          message: current.error ?? current.message,
          error: current.error ?? null,
        });
      }
    } catch (e) {
      if (runTokenRef.current !== runToken) return;
      setJob({
        phase: "error",
        stage: "running",
        progress: 0,
        progressSupported: false,
        message:
          e instanceof Error
            ? e.message
            : "Failed to reach the try-on service.",
        error: e instanceof Error ? e.message : null,
      });
    }
  }

  function handleRetry() {
    if (!personImage || !garmentImage) {
      toast.error("Please provide both images to retry.");
      return;
    }
    void handleRunTryOn();
  }

  async function refreshHistory() {
    try {
      const d = await apiClient.get<{ results: SaveTarget[] }>(
        API_ENDPOINTS.tryonResults,
      );
      setHistory(d.results);
    } catch {
      // Best effort; history is refreshed on save too.
    }
  }

  function openSaveDialog(target: "outfit" | "wardrobe") {
    if (!result?.resultId) {
      toast.error("Generate a try-on result first.");
      return;
    }
    setSaveName("");
    setSaveDialog(target);
  }

  async function confirmSave() {
    if (!result?.resultId || !saveDialog) return;
    setSaving(true);
    try {
      if (saveDialog === "outfit") {
        await apiClient.post<{ savedOutfitId: string }>(
          `${API_ENDPOINTS.tryon}/save/outfit`,
          {
            resultId: result.resultId,
            name: saveName.trim() || "Virtual Try-On",
            category: "casual",
          },
        );
        toast.success("Saved to your Saved Outfits.");
      } else {
        await apiClient.post<{ wardrobeItemId: string }>(
          `${API_ENDPOINTS.tryon}/save/wardrobe`,
          {
            resultId: result.resultId,
            name: saveName.trim() || "Garment",
            category,
            ...(garmentLabel.trim() ? { color: "#888888" } : {}),
          },
        );
        toast.success("Added to your Wardrobe.");
      }
      setSaveDialog(null);
      setSaveName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload() {
    if (!result) return;
    const src = resolveApiUrl(result.resultImageUrl);
    if (!src) return;
    try {
      const token = getAccessToken();
      const res = await fetch(src, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = (blob.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
      a.download = `stylaiize-tryon-${result.provider}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download the result.");
    }
  }

  async function handleDeleteResult(id: string) {
    try {
      await apiClient.delete(`${API_ENDPOINTS.tryon}/results/${id}`);
      setHistory((prev) => prev.filter((r) => r.id !== id));
      toast.success("Try-on result deleted.");
    } catch {
      toast.error("Failed to delete the result.");
    }
  }

  const providerName =
    status?.activeProvider === "idm_vton"
      ? "IDM-VTON"
      : status?.activeProvider === "catvton"
        ? "CatVTON"
        : status?.activeProvider ?? "not configured";

  const resultImageSrc = resolveApiUrl(result?.resultImageUrl);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <ScanLine className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Virtual Try-On</h1>
          <p className="text-sm text-muted-foreground">
            Preview garments on a photo of you
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!checking && status && (
            <Badge
              variant={status.configured ? "default" : "secondary"}
              className="gap-1.5"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status.configured ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {status.configured ? `${providerName} ready` : "Not configured"}
            </Badge>
          )}
        </div>
      </div>

      {checking ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Not-configured notice (technical, actionable, NOT 'coming soon') */}
            {status && !status.configured && (
              <div className="rounded-2xl border border-border bg-card/50 p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">
                      Try-on provider is not configured
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      An administrator must set{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">
                        VTON_SERVICE_URL
                      </code>{" "}
                      (IDM-VTON FastAPI) or{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">
                        VTON_CATVTON_API_URL
                      </code>{" "}
                      (CatVTON) on the API server. You can still upload photos
                      and press{" "}
                      <span className="font-semibold text-foreground">
                        Try It On
                      </span>{" "}
                      to get the exact server-side configuration error. API
                      keys never leave the server.
                    </p>
                    {status.message && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {status.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Uploads */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div
                className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50 p-4 text-center transition-colors hover:border-primary/60"
                onClick={() => personInputRef.current?.click()}
              >
                {personImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={personImage}
                    alt="Person"
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <>
                    <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Upload a photo of you</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Camera className="h-3 w-3" /> or take a photo
                    </p>
                  </>
                )}
                <input
                  ref={personInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) =>
                    void handleFile(setPersonImage, e.target.files?.[0])
                  }
                />
              </div>

              <div
                className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50 p-4 text-center transition-colors hover:border-primary/60"
                onClick={() => garmentInputRef.current?.click()}
              >
                {garmentImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={garmentImage}
                    alt="Garment"
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <>
                    <ImagePlus className="mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Upload a garment photo</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Shirt, dress, top, trousers, etc.
                    </p>
                  </>
                )}
                <input
                  ref={garmentInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) =>
                    void handleFile(setGarmentImage, e.target.files?.[0])
                  }
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2 sm:flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Garment category (helps the model)
                </p>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as OutfitItemType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTFIT_ITEM_TYPES.filter((t) => CATEGORY_LABELS[t]).map(
                      (t) => (
                        <SelectItem key={t} value={t}>
                          {CATEGORY_LABELS[t]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:flex-1">
                <Label className="text-xs font-medium text-muted-foreground">
                  Garment label (optional)
                </Label>
                <Input
                  value={garmentLabel}
                  onChange={(e) => setGarmentLabel(e.target.value)}
                  placeholder="e.g. Navy blazer"
                />
              </div>
              <Button
                size="lg"
                className="gap-2"
                disabled={job.phase === "running" || !personImage || !garmentImage}
                onClick={() => void handleRunTryOn()}
              >
                {job.phase === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shirt className="h-4 w-4" />
                )}
                {job.phase === "running" ? "Generating preview..." : "Try It On"}
              </Button>
            </div>

            {/* Status / Result */}
            <AnimatePresence mode="wait">
              {job.phase === "running" && (
                <motion.div
                  key="running"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card/50 p-8 text-center"
                >
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm font-medium">
                    {job.message ??
                      (providerName === "not configured"
                        ? "Preparing try-on..."
                        : `Running ${providerName} inference...`)}
                  </p>
                  {job.progressSupported ? (
                    <div className="w-full max-w-sm space-y-2">
                      <Progress value={job.progress ?? 0} />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {job.stage ? STAGE_LABELS[job.stage] : "Starting"}
                        </span>
                        <span>{Math.round(job.progress ?? 0)}%</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {job.stage ? STAGE_LABELS[job.stage] : "Running inference"}.
                      This provider does not expose detailed progress.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    GPU inference can take 10-60 seconds. Please keep this window
                    open.
                  </p>
                </motion.div>
              )}

              {job.phase === "needs_config" && (
                <motion.div
                  key="needs_config"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-border bg-card/50 p-6"
                >
                  <h3 className="mb-2 flex items-center gap-2 text-base font-bold">
                    <AlertTriangle className="h-5 w-5 text-amber-500" /> Provider
                    not configured
                  </h3>
                  <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-xs text-muted-foreground">
                    {job.message}
                  </pre>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Your photos were not uploaded anywhere. Once a provider is
                    configured on the server, retry to get a real result.
                  </p>
                </motion.div>
              )}

              {job.phase === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <div>
                      <h3 className="mb-1 text-sm font-semibold text-destructive">
                        Try-on generation failed
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {job.message ??
                          "The provider returned an error. Check the result below and the server logs."}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={handleRetry}
                    >
                      <RefreshCcw className="h-4 w-4 mr-1" /> Retry
                    </Button>
                  </div>
                </motion.div>
              )}

              {job.phase === "success" && result && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 rounded-2xl border border-border bg-card/50 p-6"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="flex items-center gap-2 text-base font-bold">
                      <Sparkles className="h-4 w-4 text-primary" /> Result
                    </h3>
                    <Badge variant="default" className="gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {providerName} · {result.processingTimeMs?.toFixed(0)}ms
                    </Badge>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDownload()}
                      >
                        <DownloadCloud className="h-4 w-4 mr-1" /> Download
                      </Button>
                      <Button size="sm" onClick={() => openSaveDialog("outfit")}>
                        <Save className="h-4 w-4 mr-1" /> Save to Outfits
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openSaveDialog("wardrobe")}
                      >
                        <FolderPlus className="h-4 w-4 mr-1" /> Add to Wardrobe
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRetry}
                        title="Regenerate"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resultImageSrc}
                    alt="Try-on result"
                    className="mx-auto max-h-[480px] rounded-xl object-contain"
                  />
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openSaveDialog("outfit")}>
                      <Save className="h-4 w-4 mr-1" /> Use in a Saved Outfit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openSaveDialog("wardrobe")}>
                      <FolderPlus className="h-4 w-4 mr-1" /> Add to Wardrobe
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* History */}
            {history.length > 0 && (
              <div className="rounded-2xl border border-border bg-card/50 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-base font-bold">
                    <FolderPlus className="h-4 w-4 text-primary" /> Your try-on
                    history
                  </h3>
                  <Badge variant="secondary">{history.length}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {history.map((r) => (
                    <div
                      key={r.id}
                      className="group relative overflow-hidden rounded-xl border border-border bg-background"
                    >
                      {r.resultImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveApiUrl(r.resultImageUrl)}
                          alt={r.garmentLabel ?? "Try-on result"}
                          className="aspect-[3/4] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[3/4] w-full items-center justify-center bg-muted text-muted-foreground">
                          <Shirt className="h-8 w-8" />
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteResult(r.id);
                        }}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        title="Delete result"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="border-t border-border p-2">
                        <p className="truncate text-xs font-medium">
                          {r.garmentLabel ?? r.provider}
                        </p>
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {r.provider}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save dialogs */}
      <Dialog
        open={saveDialog !== null}
        onOpenChange={(o) => !o && setSaveDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {saveDialog === "outfit"
                ? "Save as a Saved Outfit"
                : "Add to Wardrobe"}
            </DialogTitle>
            <DialogDescription>
              {saveDialog === "outfit"
                ? "This generated look will be stored in your Saved Outfits."
                : "The garment from this try-on will be added to your Wardrobe."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Label</Label>
            <Input
              value={saveName || garmentLabel}
              placeholder={
                saveDialog === "outfit"
                  ? "e.g. Wedding sherwani look"
                  : "e.g. Navy blazer"
              }
              onChange={(e) => setSaveName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialog(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void confirmSave()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
