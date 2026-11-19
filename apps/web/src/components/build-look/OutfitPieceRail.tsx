"use client";

import { ExternalLink } from "lucide-react";
import type { OutfitPiece } from "./types";

interface OutfitPieceRailProps {
  pieces: OutfitPiece[];
  activePieceId: string | null;
  onSelect: (pieceId: string) => void;
}

interface OutfitProductPanelProps {
  piece: OutfitPiece | null;
}

function safeBackgroundImage(url: string): string {
  return `url("${url.replace(/["\\]/g, "\\$&")}")`;
}

export function OutfitPieceRail({ pieces, activePieceId, onSelect }: OutfitPieceRailProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2" aria-label="3D outfit pieces">
      {pieces.map((piece) => (
        <button
          key={piece.id}
          type="button"
          onClick={() => onSelect(piece.id)}
          aria-pressed={activePieceId === piece.id}
          className={`flex w-40 shrink-0 items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors ${
            activePieceId === piece.id
              ? "border-cyan-300/60 bg-cyan-400/10"
              : "border-white/10 bg-white/[0.03] hover:border-white/25"
          }`}
        >
          <span
            role="img"
            aria-label={piece.name}
            className="h-11 w-11 shrink-0 rounded-lg border border-white/10 bg-slate-900 bg-cover bg-center"
            style={
              piece.product?.imageUrl
                ? { backgroundImage: safeBackgroundImage(piece.product.imageUrl) }
                : { backgroundColor: piece.colorHex }
            }
          />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-semibold text-white">{piece.name}</span>
            <span
              className={`mt-0.5 block truncate text-[10px] ${
                piece.product ? "text-cyan-200/80" : "text-amber-200/80"
              }`}
            >
              {piece.product
                ? `${piece.product.currency} ${piece.product.price.toLocaleString("en-IN")}`
                : "No verified product found."}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function OutfitProductPanel({ piece }: OutfitProductPanelProps) {
  if (!piece) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] text-slate-400">
        Select a hotspot or outfit piece to inspect its verified product details.
      </div>
    );
  }

  const product = piece.product;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            {piece.category}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white">{piece.name}</h3>
        </div>
        <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[10px] text-amber-100">
          {piece.renderMode === "exact" ? "Exact product GLB" : "3D approximation"}
        </span>
      </div>

      {product ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[84px_1fr]">
          <div
            role="img"
            aria-label={product.title}
            className="h-20 w-20 rounded-lg border border-white/10 bg-slate-900 bg-cover bg-center"
            style={{ backgroundImage: safeBackgroundImage(product.imageUrl ?? "") }}
          />
          <div className="min-w-0 space-y-1 text-[11px] leading-relaxed text-slate-300">
            <p className="font-semibold text-white">{product.title}</p>
            <p>
              {product.brand ?? product.store} · {product.currency} {product.price.toLocaleString("en-IN")}
            </p>
            <p>{product.colors.length ? product.colors.join(", ") : "Colour not supplied"}</p>
            <p>{product.sizes.length ? `Sizes: ${product.sizes.join(", ")}` : "Sizes not supplied"}</p>
            {product.priceVerifiedAt && (
              <p className="text-slate-500">Price checked {new Date(product.priceVerifiedAt).toLocaleString("en-IN")}</p>
            )}
            <a
              href={product.buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-cyan-200 hover:text-cyan-100"
            >
              View verified product <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100">
          No verified product found. The 3D garment uses outfit styling guidance only.
        </p>
      )}
    </div>
  );
}
