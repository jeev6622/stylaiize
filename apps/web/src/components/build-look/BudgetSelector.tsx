"use client";

import { IndianRupee } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BudgetLevel } from "./types";

interface BudgetSelectorProps {
  selected: BudgetLevel;
  onSelect: (level: BudgetLevel) => void;
}

const levels: { value: BudgetLevel; label: string }[] = [
  { value: "2000", label: "\u20B92,000" },
  { value: "5000", label: "\u20B95,000" },
  { value: "10000", label: "\u20B910,000" },
  { value: "premium", label: "Premium" },
];

export function BudgetSelector({ selected, onSelect }: BudgetSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Set your budget
      </p>
      <div className="flex flex-wrap gap-2">
        {levels.map(({ value, label }) => {
          const isActive = selected === value;
          return (
            <button
              key={value}
              onClick={() => onSelect(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300",
                isActive
                  ? "bg-cyan-500 text-white shadow-[0_0_24px_-4px_rgba(6,182,212,0.5)]"
                  : "border border-border bg-transparent text-muted-foreground hover:border-cyan-500/40 hover:text-foreground",
              )}
            >
              <IndianRupee className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
