"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  Palette,
  CloudSun,
  Sparkles,
  IndianRupee,
  Check,
  Minus,
} from "lucide-react";

interface AIAnalysisProps {
  styleMatch: number;
  eventMatch: number;
  isVisible: boolean;
  hasWeatherContext?: boolean;
  hasBudgetEstimate?: boolean;
}

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const item = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

function ScoreRing({ label, value }: { label: string; value: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-16 w-16">
        <svg
          className="h-full w-full -rotate-90"
          viewBox="0 0 64 64"
          fill="none"
        >
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="4"
          />
          <motion.circle
            cx="32"
            cy="32"
            r={radius}
            stroke="url(#ring-gradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
          <defs>
            <linearGradient id="ring-gradient" x1="0" y1="0" x2="64" y2="64">
              <stop stopColor="#06B6D4" />
              <stop offset="1" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
          {value}%
        </span>
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function AIAnalysis({
  styleMatch,
  eventMatch,
  isVisible,
  hasWeatherContext = false,
  hasBudgetEstimate = false,
}: AIAnalysisProps) {
  if (!isVisible) return null;

  const checks = [
    { label: "Event Match", icon: Calendar, status: "matched" as const },
    { label: "Color Match", icon: Palette, status: "matched" as const },
    {
      label: "Weather Match",
      icon: CloudSun,
      status: hasWeatherContext ? ("matched" as const) : ("na" as const),
    },
    { label: "Style Match", icon: Sparkles, status: "matched" as const },
    {
      label: "Budget Estimate",
      icon: IndianRupee,
      status: hasBudgetEstimate ? ("estimate" as const) : ("na" as const),
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="glass rounded-2xl border border-border/50 p-5 backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center justify-center gap-6">
        <ScoreRing label="Style Match" value={styleMatch} />
        <ScoreRing label="Event Match" value={eventMatch} />
      </div>

      <div className="space-y-2">
        {checks.map(({ label, icon: Icon, status }) => {
          const matched = status === "matched";
          const isEstimate = status === "estimate";
          return (
            <motion.div
              key={label}
              variants={item}
              className="flex items-center gap-3 rounded-xl bg-secondary/30 px-3 py-2"
            >
              <div
                className={`grid h-7 w-7 place-items-center rounded-full ${matched || isEstimate ? "bg-cyan-500/15" : "bg-secondary/60"}`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${matched || isEstimate ? "text-cyan-400" : "text-muted-foreground"}`}
                />
              </div>
              <span className="flex-1 text-sm text-foreground">{label}</span>
              {matched ? (
                <Check className="h-4 w-4 text-cyan-400" />
              ) : isEstimate ? (
                <span className="text-[10px] font-medium uppercase tracking-wide text-cyan-300/90">
                  Estimated
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Minus className="h-3 w-3" />
                  N/A
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
