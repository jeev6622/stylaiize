"use client";

import type { BuildLookShopResult, GroomingPlan } from "@stylaiize/shared";
import {
  ExternalLink,
  Footprints,
  RefreshCw,
  Search,
  Shirt,
  Sparkles,
  Watch,
  Scissors,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  buildOutfitBreakdown,
  getVerifiedProduct,
  type OutfitBreakdownItem,
  type OutfitBreakdownSectionId,
} from "@/lib/outfit-breakdown";
import type { OutfitData } from "./types";

interface OutfitBreakdownProps {
  outfit: OutfitData;
  grooming: GroomingPlan | null;
  shopResult: BuildLookShopResult | null;
  replacingId?: string | null;
  onReplace?: (itemId: string) => void;
}

const SECTION_ICONS: Record<OutfitBreakdownSectionId, typeof Shirt> = {
  upperwear: Shirt,
  lowerwear: Scissors,
  footwear: Footprints,
  accessories: Watch,
  grooming: Sparkles,
};

export function OutfitBreakdown({
  outfit,
  grooming,
  shopResult,
  replacingId,
  onReplace,
}: OutfitBreakdownProps) {
  const sections = buildOutfitBreakdown({ outfit, grooming, shopResult });

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 backdrop-blur-xl sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Complete outfit breakdown
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Every recommended piece</h2>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-slate-400">
          These are the exact items produced by your AI stylist. Verified shopping results are
          shown only after a live product search succeeds.
        </p>
      </div>

      <div className="mt-6 space-y-7">
        {sections.map((section, sectionIndex) => {
          const Icon = SECTION_ICONS[section.id];
          return (
            <div key={section.id}>
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.04]">
                  <Icon className="h-4 w-4 text-cyan-300" />
                </span>
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">
                  {String(sectionIndex + 1).padStart(2, "0")} / {section.label}
                </h3>
                <span className="ml-auto text-[11px] text-slate-500">
                  {section.items.length} item{section.items.length === 1 ? "" : "s"}
                </span>
              </div>

              {section.items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-3 text-xs text-slate-500">
                  No {section.label.toLowerCase()} item was recommended for this look.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {section.items.map((entry) => (
                    <OutfitCard
                      key={entry.id}
                      entry={entry}
                      replacing={replacingId === entry.id}
                      onReplace={entry.isGrooming ? undefined : onReplace}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OutfitCard({
  entry,
  replacing,
  onReplace,
}: {
  entry: OutfitBreakdownItem;
  replacing: boolean;
  onReplace?: (itemId: string) => void;
}) {
  const verifiedProduct = getVerifiedProduct(entry.shopMatch);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-cyan-300/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">{entry.categoryLabel}</p>
          <h4 className="mt-1 text-sm font-semibold leading-snug text-white">{entry.name}</h4>
        </div>
        {entry.colour ? (
          <span
            className="mt-1 h-5 w-5 shrink-0 rounded-full border border-white/20"
            style={{ backgroundColor: entry.colour }}
            title={entry.colour}
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-slate-300">
        {entry.colour ? <Chip label={`Colour: ${entry.colour}`} /> : null}
        {entry.fit ? <Chip label={`Fit: ${entry.fit}`} /> : null}
      </div>

      {entry.description ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-300">{entry.description}</p>
      ) : null}
      {entry.reason ? (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          <span className="font-semibold text-cyan-300">Why: </span>
          {entry.reason}
        </p>
      ) : null}

      <div className="mt-3 rounded-xl border border-white/5 bg-slate-950/50 px-3 py-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <Search className="h-3 w-3" />
          Shopping query
        </p>
        <p className="mt-1 break-words text-[11px] text-slate-200">
          {entry.shoppingQuery || "No shopping search was run for this item."}
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-white/5 bg-slate-950/50 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Verified result
        </p>
        {verifiedProduct ? (
          <div className="mt-1 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-100">{verifiedProduct.title}</p>
              <p className="text-[11px] text-slate-400">
                {verifiedProduct.store} - {formatCurrency(verifiedProduct.price, verifiedProduct.currency)}
              </p>
            </div>
            <a
              href={verifiedProduct.buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-cyan-200",
              )}
              aria-label={`Open ${verifiedProduct.title} at ${verifiedProduct.store}`}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500">No verified live listing yet.</p>
        )}
      </div>

      {onReplace ? (
        <button
          type="button"
          disabled={replacing}
          onClick={() => onReplace(entry.id)}
          className="mt-auto flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 pt-3 text-[11px] font-semibold text-slate-200 transition-colors hover:border-cyan-300/30 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3 w-3", replacing && "animate-spin")} />
          {replacing ? "Replacing..." : "Replace item"}
        </button>
      ) : null}
    </article>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 capitalize">
      {label}
    </span>
  );
}
