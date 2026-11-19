"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { AlertTriangle, ImageOff, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import type {
  CompleteOutfitImage as CompleteOutfitImageData,
  CompleteOutfitImageStatus,
  ShopAudience,
} from "@stylaiize/shared";

interface CompleteOutfitImageProps {
  image: CompleteOutfitImageData | null | undefined;
  audience: ShopAudience;
  status?: CompleteOutfitImageStatus | null;
  message?: string | null;
  onGenerate?: () => void;
  onRetry?: () => void;
  isLoading?: boolean;
}

const NO_IMAGE_MESSAGE =
  "No outfit preview is available. Add verified product images to this look, then try again. The 3D avatar elsewhere on this page is a styling visualization only, not a virtual try-on or a photograph of this outfit.";

const CONFIG_MESSAGE =
  "Complete-outfit image generation is not configured on the API server. No image was generated.";

const ERROR_MESSAGE =
  "The outfit image provider could not render this exact outfit. No image was generated.";

function isUsableImage(
  image: CompleteOutfitImageData | null | undefined,
  audience: ShopAudience,
  status?: CompleteOutfitImageStatus | null,
): image is CompleteOutfitImageData {
  if (status === "error" || status === "not_configured") return false;
  if (!image?.url || !image.provider || !image.license) return false;
  if (!/^https:\/\/[^\s]+$/i.test(image.url)) return false;
  if (image.audience !== audience && image.audience !== "unisex") return false;
  if (image.matchBasis !== "verified_products" && image.matchBasis !== "ai_outfit") return false;
  if (typeof image.generatedAt !== "string" || Number.isNaN(Date.parse(image.generatedAt))) {
    return false;
  }
  return true;
}

interface StatePanelProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
  tone?: "neutral" | "warning" | "error";
}

function StatePanel({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  busy,
  tone = "neutral",
}: StatePanelProps) {
  const iconTone =
    tone === "error"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
      : tone === "warning"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
        : "border-white/10 bg-white/[0.04] text-slate-400";

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className={`grid h-12 w-12 place-items-center rounded-full border ${iconTone}`}>
          {icon}
        </span>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="max-w-xl text-sm leading-relaxed text-slate-400">{description}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            disabled={busy}
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function CompleteOutfitImage({
  image,
  audience,
  status = null,
  message,
  onGenerate,
  onRetry,
  isLoading = false,
}: CompleteOutfitImageProps) {
  if (isLoading) {
    return (
      <StatePanel
        icon={<Loader2 className="h-5 w-5 animate-spin" />}
        title="Building outfit preview"
        description="Creating a local flat-lay from the verified product images selected for this outfit. No stock photo, avatar or screenshot is used as the result."
      />
    );
  }

  if (status === "error") {
    return (
      <StatePanel
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Complete-outfit image unavailable"
        description={message || ERROR_MESSAGE}
        actionLabel="Retry"
        onAction={onRetry}
        tone="error"
      />
    );
  }

  if (status === "not_configured") {
    return (
      <StatePanel
        icon={<ImageOff className="h-5 w-5" />}
        title="Provider configuration required"
        description={message || CONFIG_MESSAGE}
        actionLabel="Generate image"
        onAction={onGenerate}
        tone="warning"
      />
    );
  }

  if (!isUsableImage(image, audience, status)) {
    return (
      <StatePanel
        icon={<ImageOff className="h-5 w-5" />}
        title="Complete outfit wearing image"
        description={message || NO_IMAGE_MESSAGE}
        actionLabel="Generate image"
        onAction={onGenerate}
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
          {image.label || "Outfit preview"}
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-200">
          <ShieldCheck className="h-3 w-3" />
          {image.provider}
        </span>
      </div>
      <div className="flex justify-center bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05),transparent_65%)] p-4">
        <Image
          src={image.url}
          alt={
            image.matchBasis === "verified_products"
              ? "Flat-lay preview of the verified products selected for this outfit"
              : `Complete AI-recommended outfit worn by a ${image.audience} model`
          }
          width={1200}
          height={900}
          unoptimized
          className="max-h-[70vh] w-full max-w-3xl rounded-2xl object-contain"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
        <p className="text-[11px] text-slate-500">
          {image.matchBasis === "verified_products"
            ? "Outfit preview from verified product images · Not a photograph of a person · "
            : `Provider: ${image.provider} · Licence: ${image.license} · `}
          Created: {image.generatedAt}
        </p>
        {onGenerate ? (
          <button
            type="button"
            onClick={onGenerate}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.08]"
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </button>
        ) : null}
      </div>
    </section>
  );
}
