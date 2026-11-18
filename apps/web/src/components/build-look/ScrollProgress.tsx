"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScrollProgressProps {
  totalStages: number;
  currentStage: number;
  stageLabels: string[];
}

export function ScrollProgress({
  totalStages,
  currentStage,
  stageLabels,
}: ScrollProgressProps) {
  const filledPercent = totalStages > 1
    ? (currentStage / (totalStages - 1)) * 100
    : 0;

  return (
    <div className="pointer-events-none fixed right-6 top-1/2 z-50 -translate-y-1/2 md:right-8">
      <div className="relative flex flex-col items-center gap-0">
        <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white/10" />
        <motion.div
          className="absolute left-1/2 top-0 w-0.5 -translate-x-1/2 origin-top bg-gradient-to-b from-primary to-[#06B6D4]"
          style={{ height: `${filledPercent}%` }}
          initial={false}
          animate={{ height: `${filledPercent}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />

        <div
          className="flex flex-col items-center"
          style={{ height: `${Math.max(totalStages * 40, 120)}px` }}
        >
          {Array.from({ length: totalStages }).map((_, i) => {
            const isCompleted = i < currentStage;
            const isActive = i === currentStage;
            const isFuture = i > currentStage;

            return (
              <div
                key={i}
                className="group pointer-events-auto relative flex items-center"
                style={{
                  position: "absolute",
                  top: `${totalStages > 1 ? (i / (totalStages - 1)) * 100 : 50}%`,
                  transform: "translateY(-50%)",
                }}
              >
                <motion.div
                  className={cn(
                    "relative z-10 rounded-full border-2 transition-colors duration-300",
                    isActive && "h-4 w-4 border-[#06B6D4] bg-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.6)]",
                    isCompleted && "h-3 w-3 border-primary bg-primary",
                    isFuture && "h-3 w-3 border-white/20 bg-transparent",
                  )}
                  initial={false}
                  animate={
                    isActive
                      ? { scale: [1, 1.3, 1], transition: { duration: 1.5, repeat: Infinity } }
                      : { scale: 1 }
                  }
                />

                <div
                  className={cn(
                    "absolute right-8 whitespace-nowrap text-xs font-medium transition-all duration-300",
                    "hidden md:block",
                    isActive
                      ? "translate-x-0 opacity-100"
                      : "pointer-events-none translate-x-2 opacity-0 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block rounded-md px-2.5 py-1 backdrop-blur-md",
                      isActive
                        ? "bg-[#06B6D4]/15 text-[#06B6D4]"
                        : "bg-white/5 text-white/60",
                    )}
                  >
                    {stageLabels[i] ?? `Stage ${i + 1}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
