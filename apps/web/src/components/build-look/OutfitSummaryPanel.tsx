"use client";

import { Palette, Scissors, Sparkles } from "lucide-react";
import type { ShopAudience } from "@stylaiize/shared";
import type { OutfitData } from "./types";

interface OutfitSummaryPanelProps {
  outfit: OutfitData;
  audience: ShopAudience;
  occasion?: string;
  style?: string;
}

export function OutfitSummaryPanel({
  outfit,
  audience,
  occasion,
  style,
}: OutfitSummaryPanelProps) {
  const palette = (outfit.recommendedColors?.length
    ? outfit.recommendedColors
    : outfit.items.map((item) => item.color).filter(Boolean))
    .slice(0, 6)
    .map((color) => color.trim())
    .filter(Boolean);

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold capitalize text-cyan-100">
          {outfit.eventName}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] capitalize text-slate-200">
          {audience}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] capitalize text-slate-200">
          {style || outfit.styleName}
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            <Palette className="h-3.5 w-3.5 text-cyan-300" />
            Recommended colours
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {palette.length > 0 ? (
              palette.map((color, index) => (
                <span
                  key={`${color}-${index}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-200"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-white/20"
                    style={{ backgroundColor: color }}
                  />
                  {color}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">No palette was produced.</span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            <Scissors className="h-3.5 w-3.5 text-cyan-300" />
            Fit guidance
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-200">
            {outfit.fitGuidance || "No specific fit guidance was produced for this look."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
        <p className="text-xs leading-relaxed text-slate-400">
          {occasion ? `Occasion: ${occasion}. ` : ""}
          {outfit.items.length} recommended pieces. This summary is AI styling guidance, not proof
          that the 3D avatar is wearing the outfit.
        </p>
      </div>
    </section>
  );
}
