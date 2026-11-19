"use client";

import { Layers3 } from "lucide-react";
import type { OutfitData } from "./types";

interface OutfitPieceBreakdownProps {
  outfit: OutfitData;
}

export function OutfitPieceBreakdown({ outfit }: OutfitPieceBreakdownProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl sm:p-6">
      <div className="flex items-center gap-2">
        <Layers3 className="h-4 w-4 text-cyan-300" />
        <h2 className="text-lg font-semibold text-white">Recommended pieces</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {outfit.items.map((item, index) => (
          <article
            key={item.id}
            className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {index + 1}. {item.category}
            </p>
            <h3 className="mt-2 text-sm font-semibold text-white">{item.name}</h3>
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">
              {item.description || item.subtitle}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
              {item.color ? (
                <span className="rounded-full border border-white/10 px-2 py-1">{item.color}</span>
              ) : null}
              {item.material ? (
                <span className="rounded-full border border-white/10 px-2 py-1">
                  {item.material}
                </span>
              ) : null}
              {item.brand ? (
                <span className="rounded-full border border-white/10 px-2 py-1">
                  {item.brand}
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
