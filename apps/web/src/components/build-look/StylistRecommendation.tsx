"use client";

import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock3,
  Palette,
  Scissors,
  Sparkles,
  Sun,
} from "lucide-react";
import type { OutfitData } from "./types";

interface StylistRecommendationProps {
  data: OutfitData;
  isVisible: boolean;
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const row = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Palette;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <motion.div variants={row} className="rounded-xl bg-secondary/30 px-3 py-3">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">{value}</p>
    </motion.div>
  );
}

export function StylistRecommendation({ data, isVisible }: StylistRecommendationProps) {
  if (!isVisible) return null;

  const dressCode = data.dressCode || data.styleName || "Smart Casual";
  const colors =
    data.recommendedColors?.length ? data.recommendedColors : data.colorCombination;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="glass space-y-4 rounded-2xl border border-border/50 p-6 backdrop-blur-xl"
    >
      <motion.div variants={row} className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">
          AI Stylist Recommendation
        </span>
      </motion.div>

      <motion.div variants={row} className="rounded-2xl border border-primary/30 bg-primary/10 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          Recommended dress code
        </p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-foreground">{dressCode}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {data.dressCodeReason || data.explanation || `A ${dressCode} direction for ${data.eventName}.`}
        </p>
      </motion.div>

      <motion.div variants={row} className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-secondary/30 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Occasion
          </p>
          <p className="mt-1 text-sm text-foreground">{data.eventName}</p>
        </div>
        <div className="rounded-xl bg-secondary/30 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Style direction
          </p>
          <p className="mt-1 text-sm text-foreground">{data.styleName}</p>
        </div>
      </motion.div>

      <div className="space-y-2">
        <Detail
          icon={Palette}
          label="Recommended colours"
          value={Array.isArray(colors) ? colors.join(", ") : colors}
        />
        <Detail icon={Scissors} label="Fit and clothing style" value={data.fitGuidance} />
        <Detail
          icon={Sparkles}
          label="Grooming and accessories"
          value={[data.groomingGuidance, data.accessoryGuidance].filter(Boolean).join(" ") || data.accessories?.join(", ")}
        />
        <Detail
          icon={CalendarDays}
          label="Occasion suitability"
          value={data.occasionSuitability || data.explanation}
        />
        <Detail icon={Sun} label="Season suitability" value={data.seasonSuitability || data.weatherNote} />
        <Detail icon={Clock3} label="Weather note" value={data.weatherNote} />
      </div>

      <motion.p variants={row} className="text-xs text-muted-foreground">
        This is AI styling guidance. Prices, stock and purchase links come only from connected shopping providers.
      </motion.p>
    </motion.div>
  );
}
