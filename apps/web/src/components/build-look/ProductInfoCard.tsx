"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Palette, Ruler, Layers, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { OutfitItem } from "./types";

interface ProductInfoCardProps {
  item: OutfitItem;
  isVisible: boolean;
  onClose: () => void;
  onReplace: (itemId: string) => void;
  isReplacing: boolean;
}

export function ProductInfoCard({
  item,
  isVisible,
  onClose,
  onReplace,
  isReplacing,
}: ProductInfoCardProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 80 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="glass-strong fixed right-4 top-1/2 z-50 w-[380px] max-w-[calc(100vw-2rem)] -translate-y-1/2 rounded-2xl border border-border/60 p-6 shadow-2xl backdrop-blur-2xl"
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Styling guidance
              </p>
              <h3 className="mt-1 text-xl font-bold text-foreground">{item.name}</h3>
              {item.subtitle ? (
                <p className="text-sm text-muted-foreground">{item.subtitle}</p>
              ) : null}
            </div>

            {item.description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <DetailRow icon={Layers} label="Category" value={item.category} />
              <DetailRow icon={Palette} label="Colour" value={item.color || "Not provided"}
 />
              <DetailRow icon={Ruler} label="Fit/Size" value={item.size || "Not provided"}
 />
              <DetailRow icon={Layers} label="Material" value={item.material || "Not provided"}
 />
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
              This is an AI styling suggestion, not a verified product listing. Prices, brands, stores, and availability are not included.
            </div>

            <Button
              className="w-full gap-2"
              size="lg"
              variant="secondary"
              disabled={isReplacing}
              onClick={() => onReplace(item.id)}
            >
              <RefreshCw className={cn("h-4 w-4", isReplacing && "animate-spin")} />
              {isReplacing ? "Finding an alternative..." : "Replace this item"}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-secondary/30 px-3 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-medium capitalize text-foreground">{value}</p>
      </div>
    </div>
  );
}
