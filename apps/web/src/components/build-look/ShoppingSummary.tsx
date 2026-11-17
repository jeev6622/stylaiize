"use client";

import { motion } from "framer-motion";
import { ShoppingBag, TrendingDown, IndianRupee } from "lucide-react";
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

export function ShoppingSummary({ data, isVisible }: ShoppingSummaryProps) {
  if (!isVisible) return null;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="glass rounded-2xl border border-border/50 p-6 backdrop-blur-xl"
    >
      <motion.div variants={row} className="mb-4 flex items-center gap-2">
        <ShoppingBag className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">
          Your Complete Look
        </span>
      </motion.div>

      <div className="space-y-1.5">
        {data.items.map((item) => (
          <motion.div
            key={item.id}
            variants={row}
            className="flex items-center justify-between rounded-xl bg-secondary/20 px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {item.name}
            </span>
            <span className="ml-3 shrink-0 text-sm font-medium text-muted-foreground">
              {formatCurrency(item.price)}
            </span>
          </motion.div>
        ))}
      </div>

      <motion.div variants={row} className="my-4 h-px bg-border/40" />

      <motion.div variants={row} className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Original estimate</span>
          <span className="text-sm text-muted-foreground line-through">
            {formatCurrency(data.originalTotal)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Optimized price</span>
          <span className="text-lg font-bold text-emerald-400">
            {formatCurrency(data.optimizedTotal)}
          </span>
        </div>

        {data.savings > 0 && (
          <motion.div
            variants={row}
            className="flex items-center gap-2 self-start rounded-full bg-emerald-400/15 px-3 py-1"
          >
            <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">
              You save {formatCurrency(data.savings)}
            </span>
          </motion.div>
        )}
      </motion.div>

      <motion.p
        variants={row}
        className="mt-3 text-center text-xs text-muted-foreground"
      >
        StylAIze found a better combination
      </motion.p>

      <motion.div variants={row} className="mt-5">
        <Button className="w-full gap-2" size="lg">
          <IndianRupee className="h-4 w-4" />
          Shop This Look
        </Button>
      </motion.div>
    </motion.div>
  );
}
