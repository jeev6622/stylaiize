"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Info, Search, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { OutfitData } from "./types";

interface ShoppingSummaryProps {
  data: OutfitData;
  isVisible: boolean;
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const row = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

function formatBudget(estimate?: OutfitData["estimatedBudgetInr"]) {
  if (!estimate) return null;
  if (estimate.max == null) return `${formatCurrency(estimate.min, estimate.currency)}+`;
  if (estimate.min === 0) return `Up to ${formatCurrency(estimate.max, estimate.currency)}`;
  return `${formatCurrency(estimate.min, estimate.currency)} - ${formatCurrency(estimate.max, estimate.currency)}`;
}

export function ShoppingSummary({ data, isVisible }: ShoppingSummaryProps) {
  if (!isVisible) return null;

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
          Styling guidance
        </span>
      </motion.div>

      <motion.p variants={row} className="mb-4 text-sm text-muted-foreground">
        This look is a curated styling direction. Item details below are guidance, not verified product listings.
      </motion.p>

      {budgetLabel && (
        <motion.div variants={row} className="mb-4 rounded-xl bg-secondary/30 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Estimated budget
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{budgetLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Estimate based on your selected budget range. Actual prices vary by retailer and availability.
          </p>
        </motion.div>
      )}

      <div className="space-y-1.5">
        {data.items.map((item) => (
          <motion.div
            key={item.id}
            variants={row}
            className="rounded-xl bg-secondary/20 px-3 py-2"
          >
            <p className="text-sm font-medium text-foreground">{item.name}</p>
            <p className="text-xs capitalize text-muted-foreground">{item.category}</p>
            {item.description ? (
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            ) : null}
          </motion.div>
        ))}
      </div>

      {(data.explanation || data.colorCombination) && (
        <motion.div variants={row} className="mt-4 space-y-2 border-t border-border/40 pt-4">
          {data.colorCombination && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Colour combination:</span> {data.colorCombination}
            </p>
          )}
          {data.explanation && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Why it works:</span> {data.explanation}
            </p>
          )}
        </motion.div>
      )}

      <motion.div variants={row} className="mt-5 flex items-start gap-2 rounded-xl border border-border/60 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>To find real products, use live product search when a catalog is available.</span>
      </motion.div>

      <motion.div variants={row} className="mt-5">
        <Button className="w-full gap-2" size="lg" asChild>
          <Link href="/products">
            <Search className="h-4 w-4" />
            Search real products
          </Link>
        </Button>
      </motion.div>
    </motion.div>
  );
}
