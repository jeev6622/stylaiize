"use client";

import { motion } from "framer-motion";
import { Sparkles, Star } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { OutfitData } from "./types";

interface OutfitOverviewProps {
  data: OutfitData;
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const row = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

function formatBudget(estimate?: OutfitData["estimatedBudgetInr"]) {
  if (!estimate) return null;
  if (estimate.max == null) return `${formatCurrency(estimate.min, estimate.currency)}+ (estimate)`;
  if (estimate.min === 0) return `Up to ${formatCurrency(estimate.max, estimate.currency)} (estimate)`;
  return `${formatCurrency(estimate.min, estimate.currency)} - ${formatCurrency(estimate.max, estimate.currency)} (estimate)`;
}

export function OutfitOverview({ data }: OutfitOverviewProps) {
  const budgetLabel = formatBudget(data.estimatedBudgetInr);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="glass rounded-2xl border border-border/50 p-6 backdrop-blur-xl"
    >
      <motion.div variants={row} className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">
          AI Styling Guidance
        </span>
      </motion.div>

      <motion.div variants={row} className="mb-4">
        <h3 className="text-lg font-bold text-foreground">{data.eventName}</h3>
        <p className="text-sm text-muted-foreground">{data.styleName} Style</p>
      </motion.div>

      <motion.div variants={row} className="mb-5 flex gap-3">
        <ScoreBadge label="Style" value={data.styleMatch} />
        <ScoreBadge label="Event" value={data.eventMatch} />
      </motion.div>

      {budgetLabel && (
        <motion.div variants={row} className="mb-4 rounded-xl bg-secondary/30 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Estimated budget
          </p>
          <p className="text-sm font-medium text-foreground">{budgetLabel}</p>
        </motion.div>
      )}

      <div className="space-y-1.5">
        {data.items.map((item) => (
          <motion.div
            key={item.id}
            variants={row}
            className="flex items-center gap-3 rounded-xl bg-secondary/30 px-3 py-2"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{item.name}</p>
              {item.description ? (
                <p className="truncate text-xs text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
          </motion.div>
        ))}
      </div>

      {(data.colorCombination || data.footwear || (data.accessories && data.accessories.length > 0) || data.explanation || data.weatherNote) && (
        <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
          {data.colorCombination && (
            <motion.div variants={row}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Colour combination</p>
              <p className="mt-0.5 text-sm text-foreground">{data.colorCombination}</p>
            </motion.div>
          )}
          {data.footwear && (
            <motion.div variants={row}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Footwear</p>
              <p className="mt-0.5 text-sm text-foreground">{data.footwear}</p>
            </motion.div>
          )}
          {data.accessories && data.accessories.length > 0 && (
            <motion.div variants={row}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accessories</p>
              <p className="mt-0.5 text-sm text-foreground">{data.accessories.join(", ")}</p>
            </motion.div>
          )}
          {data.explanation && (
            <motion.div variants={row}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Styling explanation</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{data.explanation}</p>
            </motion.div>
          )}
          {data.weatherNote && (
            <motion.div variants={row}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weather note</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{data.weatherNote}</p>
            </motion.div>
          )}
        </div>
      )}

      <motion.p variants={row} className="mt-4 text-xs text-muted-foreground">
        This is styling guidance, not a verified product listing.
      </motion.p>
    </motion.div>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="text-xs font-semibold text-foreground">{value}%</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
