"use client";

import {
  Crown,
  Zap,
  Gem,
  Minus,
  Coffee,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StyleType } from "./types";

interface StyleSelectorProps {
  selected: StyleType;
  onSelect: (style: StyleType) => void;
}

const styles: { type: StyleType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "classic", label: "Classic", icon: Crown },
  { type: "modern", label: "Modern", icon: Zap },
  { type: "luxury", label: "Luxury", icon: Gem },
  { type: "minimal", label: "Minimal", icon: Minus },
  { type: "streetwear", label: "Streetwear", icon: Coffee },
  { type: "traditional", label: "Traditional", icon: Landmark },
];

export function StyleSelector({ selected, onSelect }: StyleSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Want a different style?
      </p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
        {styles.map(({ type, label, icon: Icon }) => {
          const isActive = selected === type;
          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300",
                isActive
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "border border-border bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
