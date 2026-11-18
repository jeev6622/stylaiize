"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, ShoppingBag, Tag, Palette, Ruler, Building2, ExternalLink, RefreshCw } from "lucide-react";
import { cn, formatCurrency, storeSearchUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { OutfitItem } from "./types";

interface ProductInfoCardProps {
  item: OutfitItem;
  isVisible: boolean;
  onClose: () => void;
  onReplace: (itemId: string) => void;
  isReplacing: boolean;
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
      <span className="ml-1.5 text-sm text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}export function ProductInfoCard({
  item,
  isVisible,
  onClose,
  onReplace,
  isReplacing,
}: ProductInfoCardProps) {
  // Only link out when we recognise the store. The AI suggests a store name,
  // it does not return a verified product URL, so we never fake one.
  const searchUrl = storeSearchUrl(item.store, item.name);

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
          >
            <X className="h-4 w-4" />
          </button>

          {item.imageUrl && (
            <div className="relative mb-4 h-44 w-full overflow-hidden rounded-xl bg-secondary/30">
              <Image
                src={item.imageUrl}
                alt={item.name}
                fill
                sizes="(max-width: 420px) calc(100vw - 4rem), 332px"
                unoptimized
                className="object-cover"
              />
            </div>
          )}

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {item.brand}
              </p>
              <h3 className="mt-1 text-xl font-bold text-foreground">{item.name}</h3>
              <p className="text-sm text-muted-foreground">{item.subtitle}</p>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-foreground">
                {formatCurrency(item.price)}
              </span>
              <RatingStars rating={item.rating} />
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <DetailRow icon={Tag} label="Category" value={item.category} />
              <DetailRow icon={Palette} label="Color" value={item.color} />
              <DetailRow icon={Ruler} label="Size" value={item.size} />
              <DetailRow icon={Building2} label="Store" value={item.store} />
            </div>

            <div className="rounded-xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              Material: <span className="text-foreground">{item.material}</span>
            </div>

            {searchUrl ? (
              <Button className="w-full gap-2" size="lg" asChild>
                <a href={searchUrl} target="_blank" rel="noopener noreferrer">
                  <ShoppingBag className="h-4 w-4" />
                  Search {item.store || "stores"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            ) : (
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
                Shopping search is unavailable for{" "}
                <span className="text-foreground">{item.store || "this item"}</span> on this
                deployment. Connect a shopping provider in the API .env to enable store search.
              </div>
            )}

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
        <p className="truncate text-xs font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
