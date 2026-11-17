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

export function OutfitOverview({ data }: OutfitOverviewProps) {
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
          AI Recommended Look
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

      <div className="space-y-1.5">
        {data.items.map((item) => (
          <motion.div
            key={item.id}
            variants={row}
            className="flex items-center gap-3 rounded-xl bg-secondary/30 px-3 py-2"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {item.name}
            </span>
            <span className="text-xs text-muted-foreground">{item.brand}</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        variants={row}
        className="mt-4 border-t border-border/40 pt-3 text-right"
      >
        <span className="text-xs text-muted-foreground">Total</span>
        <p className="text-xl font-bold text-foreground">
          {formatCurrency(data.originalTotal)}
        </p>
      </motion.div>
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
