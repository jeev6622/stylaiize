"use client";

import { AlertTriangle } from "lucide-react";
import type { BuildLookShopResult } from "@stylaiize/shared";
import { ProductCard } from "@/components/products/ProductCard";

interface OutfitShoppingListProps {
  result: BuildLookShopResult | null;
  notice?: string | null;
}

export function OutfitShoppingList({ result, notice }: OutfitShoppingListProps) {
  if (!result) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">Shopping list</h2>
        <p className="mt-3 text-sm text-slate-400">
          Run product search to see verified listings for each recommended item.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-3xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl sm:p-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
          Shopping list
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">Verified products for this look</h2>
      </div>

      {notice ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-xs leading-relaxed text-amber-100/80">{notice}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {result.matches.map((match) => (
          <div key={match.itemId} className="space-y-2">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {match.itemName}
            </p>
            {match.product ? (
              <ProductCard product={match.product} />
            ) : (
              <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 text-center">
                <p className="text-xs text-slate-400">
                  No verified product available for this item.
                  {match.reason ? (
                    <span className="mt-2 block text-[11px] leading-relaxed text-slate-500">
                      {match.reason}
                    </span>
                  ) : null}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
