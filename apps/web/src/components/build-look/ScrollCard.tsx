"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { OutfitItem, ScrollStage } from "./types";

interface ScrollCardProps {
  stage: ScrollStage;
  item?: OutfitItem;
  isActive: boolean;
  index: number;
}

export function ScrollCard({ stage, item, isActive, index }: ScrollCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0.3, scale: 0.95, y: 20 }}
      animate={{
        opacity: isActive ? 1 : 0.3,
        scale: isActive ? 1.0 : 0.95,
        y: isActive ? 0 : 20,
      }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass rounded-2xl border p-6 backdrop-blur-xl transition-shadow duration-500",
        isActive
          ? "border-primary/50 shadow-glow"
          : "border-border/50 shadow-none",
      )}
    >
      <div className="mb-4 flex items-start justify-between">
        <span className="font-display text-5xl font-bold leading-none text-primary/20">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
            {stage.subtitle}
          </span>
          <span className="text-[10px] text-muted-foreground">{stage.label}</span>
        </div>
      </div>

      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-accent-foreground">
        {stage.title}
      </h3>

      {item ? (
        <div className="space-y-3">
          <div>
            <p className="text-lg font-semibold text-foreground">{item.name}</p>
            {item.subtitle ? (
              <p className="text-xs text-muted-foreground">{item.subtitle}</p>
            ) : null}
          </div>

          {item.description && (
            <blockquote className="border-l-2 border-primary/60 pl-3 text-sm italic text-muted-foreground">
              &ldquo;{item.description}&rdquo;
            </blockquote>
          )}

          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {item.color ? (
              <span className="rounded-full bg-secondary/60 px-2 py-0.5">{item.color}</span>
            ) : null}
            {item.material ? (
              <span className="rounded-full bg-secondary/60 px-2 py-0.5">{item.material}</span>
            ) : null}
            {item.size ? (
              <span className="rounded-full bg-secondary/60 px-2 py-0.5">{item.size}</span>
            ) : null}
            <span className="rounded-full bg-secondary/60 px-2 py-0.5 capitalize">{item.category}</span>
          </div>

          <p className="text-xs text-muted-foreground">Styling guidance item (not a verified product).</p>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {stage.description ?? "Scroll to explore this part of the outfit."}
        </p>
      )}
    </motion.div>
  );
}
