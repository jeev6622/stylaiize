"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Droplet,
  Info,
  Scissors,
  Smile,
  Sparkles,
  Watch,
  Wind,
} from "lucide-react";
import type { GroomingCategory, GroomingPlan } from "@stylaiize/shared";
import { GROOMING_CATEGORIES } from "@stylaiize/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

const CATEGORY_META: Record<
  GroomingCategory,
  { label: string; icon: typeof Sparkles }
> = {
  hair: { label: "Hair", icon: Scissors },
  facial: { label: "Facial grooming", icon: Smile },
  skin: { label: "Skin prep", icon: Droplet },
  accessory: { label: "Accessories", icon: Watch },
  fragrance: { label: "Fragrance", icon: Wind },
};

const SHOPPABLE: ReadonlySet<GroomingCategory> = new Set([
  "accessory",
  "fragrance",
]);

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const row = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export function GroomingSkeleton() {
  return (
    <div className="glass space-y-3 rounded-2xl border border-border/50 p-6 backdrop-blur-xl">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

interface GroomingResultsProps {
  plan: GroomingPlan;
  isVisible: boolean;
  isLoading?: boolean;
}

export function GroomingResults({
  plan,
  isVisible,
  isLoading = false,
}: GroomingResultsProps) {
  const reduceMotion = useReducedMotion();

  if (isLoading) return <GroomingSkeleton />;
  if (!isVisible) return null;

  const itemVariants = reduceMotion ? undefined : row;
  const groups = GROOMING_CATEGORIES.map((category) => ({
    category,
    items: plan.items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <motion.div
      variants={reduceMotion ? undefined : container}
      initial={reduceMotion ? false : "hidden"}
      animate={reduceMotion ? undefined : "visible"}
      className="glass space-y-5 rounded-2xl border border-border/50 p-6 backdrop-blur-xl"
    >
      <motion.div variants={itemVariants} className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cyan-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">
          Grooming & finishing
        </span>
      </motion.div>

      {plan.summary && (
        <motion.p
          variants={itemVariants}
          className="text-sm leading-relaxed text-muted-foreground"
        >
          {plan.summary}
        </motion.p>
      )}

      <div className="space-y-4">
        {groups.map(({ category, items }) => {
          const { label, icon: Icon } = CATEGORY_META[category];
          return (
            <motion.section key={category} variants={itemVariants} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-cyan-500/15">
                  <Icon className="h-3.5 w-3.5 text-cyan-400" />
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </h3>
              </div>

              <ul className="space-y-2">
                {items.map((item, index) => (
                  <li
                    key={`${category}-${index}`}
                    className="rounded-xl bg-secondary/25 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        {item.why && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.why}
                          </p>
                        )}
                        {item.tip && (
                          <p className="mt-1.5 text-xs text-muted-foreground/90">
                            <span className="font-medium text-foreground/80">
                              Tip:
                            </span>{" "}
                            {item.tip}
                          </p>
                        )}
                      </div>
                      {item.estimatedPriceInr !== undefined && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {formatCurrency(item.estimatedPriceInr)}
                        </Badge>
                      )}
                    </div>

                    {SHOPPABLE.has(category) && (
                      <div className="mt-2">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 px-2 text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          <Link
                            href={`/products?q=${encodeURIComponent(item.title)}`}
                          >
                            Find deals
                          </Link>
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </motion.section>
          );
        })}
      </div>

      <motion.p
        variants={itemVariants}
        className="flex items-start gap-2 border-t border-border/40 pt-3 text-[11px] text-muted-foreground"
      >
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Suggestions only, not professional advice. Patch-test new products and
          check with a qualified professional for any skin or scalp concerns.
        </span>
      </motion.p>
    </motion.div>
  );
}