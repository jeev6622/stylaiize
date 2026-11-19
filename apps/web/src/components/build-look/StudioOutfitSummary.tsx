"use client";

import type { BuildLookShopResult } from "@stylaiize/shared";
import { Palette, Scissors, ShieldCheck, Sparkles } from "lucide-react";
import type { AvatarSelection } from "@/lib/avatar-selection";
import { getInspirationImageUrl } from "@/lib/outfit-breakdown";
import type { OutfitData } from "./types";

interface StudioOutfitSummaryProps {
  outfit: OutfitData;
  avatarSelection: AvatarSelection;
  shopResult: BuildLookShopResult | null;
}

export function StudioOutfitSummary({
  outfit,
  avatarSelection,
  shopResult,
}: StudioOutfitSummaryProps) {
  const palette = (outfit.recommendedColors?.length
    ? outfit.recommendedColors
    : outfit.items.map((item) => item.color).filter(Boolean)
  )
    .slice(0, 6)
    .map((color) => color.trim())
    .filter(Boolean);

  const verifiedCount = shopResult?.matches.filter((match) => match.status === "found").length ?? 0;
  const inspirationImageUrl = getInspirationImageUrl(outfit);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Selected outfit
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200">
            <ShieldCheck className="h-3 w-3" />
            AI styling guidance
          </span>
        </div>

        <h2 className="mt-3 text-2xl font-semibold leading-tight text-white">{outfit.styleName}</h2>
        <p className="mt-1 text-sm text-slate-400">{outfit.eventName}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <Detail label="Audience" value={avatarSelection.audienceLabel} />
          <Detail label="Pieces" value={`${outfit.items.length}`} />
          <Detail label="Occasion" value={outfit.eventName} />
          <Detail label="Style" value={outfit.styleName} />
        </div>

        <p className="mt-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-slate-400">
          {avatarSelection.note}
          {avatarSelection.requiresChoice ? " Choose a presentation above." : ""}
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          <Palette className="h-3.5 w-3.5 text-cyan-300" />
          Recommended palette
        </p>
        {palette.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {palette.map((color, index) => (
              <span
                key={`${color}-${index}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-200"
              >
                <span className="h-2.5 w-2.5 rounded-full border border-white/20 bg-current" style={{ color }} />
                {color}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">No palette was produced for this look.</p>
        )}

        <p className="mt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          <Scissors className="h-3.5 w-3.5 text-cyan-300" />
          Fit direction
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">
          {outfit.fitGuidance || "No specific fit guidance was produced for this look."}
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-[11px] text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
          {shopResult ? `${verifiedCount} verified shopping result${verifiedCount === 1 ? "" : "s"}.` : "Shopping results not checked yet."}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Outfit inspiration
        </p>
        {inspirationImageUrl ? (
          <div className="mt-3 space-y-2">
            <div
              role="img"
              aria-label={`Inspiration image for ${outfit.styleName}`}
              className="aspect-[3/4] w-full rounded-xl border border-white/10 bg-cover bg-center"
              style={{ backgroundImage: `url("${inspirationImageUrl}")` }}
            />
            <p className="text-[10px] leading-relaxed text-slate-500">
              Supplied inspiration image. This is not a 3D garment preview or proof that the
              items are applied to the avatar.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            No verified inspiration image was supplied. The AI outfit is listed in the breakdown
            panel below.
          </p>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 truncate font-medium capitalize text-slate-100">{value}</p>
    </div>
  );
}
