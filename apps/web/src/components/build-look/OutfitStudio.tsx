"use client";

import dynamic from "next/dynamic";
import type { FashionModelId } from "./fashion-model-catalog";
import type { OutfitGarmentSlot, OutfitPiece } from "./types";

const FashionScene = dynamic(
  () => import("./FashionScene").then((module) => module.FashionScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center text-xs text-slate-400">
        Preparing the fashion studio...
      </div>
    ),
  },
);

interface OutfitStudioProps {
  modelId: FashionModelId;
  allowedModelIds: FashionModelId[];
  onAvatarModelChange: (id: FashionModelId) => void;
  autoRotate: boolean;
  onAutoRotateChange: (enabled: boolean) => void;
  highlightCategories: string[];
  activeItemId: string | null;
  pieces: OutfitPiece[];
  selectedSlot: OutfitGarmentSlot | null;
  onHotspotClick: (itemId: string) => void;
}

export function OutfitStudio({
  modelId,
  allowedModelIds,
  onAvatarModelChange,
  autoRotate,
  onAutoRotateChange,
  highlightCategories,
  activeItemId,
  pieces,
  selectedSlot,
  onHotspotClick,
}: OutfitStudioProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            3D avatar preview
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Styling visualization, not a virtual try-on
          </h2>
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 shadow-2xl shadow-black/20">
        <FashionScene
          modelId={modelId}
          allowedModelIds={allowedModelIds}
          onModelIdChange={onAvatarModelChange}
          autoRotate={autoRotate}
          onAutoRotateChange={onAutoRotateChange}
          highlightCategories={highlightCategories}
          activeItemId={activeItemId}
          pieces={pieces}
          selectedSlot={selectedSlot}
          onHotspotClick={onHotspotClick}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        The selected male or female avatar is a licensed styling visualization. Garments are
        parametric approximations unless a supplied product includes an exact GLB; this is not a
        virtual try-on.
      </p>
    </section>
  );
}
