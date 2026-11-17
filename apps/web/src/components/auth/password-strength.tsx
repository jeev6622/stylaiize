"use client";

import { cn } from "@/lib/utils";

function getStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: "" };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: "Weak" };
  if (score === 3) return { score: 2, label: "Fair" };
  if (score === 4) return { score: 3, label: "Good" };
  return { score: 4, label: "Strong" };
}

const COLOR_MAP: Record<number, string> = {
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-amber-400",
  4: "bg-success",
};

const TEXT_COLOR_MAP: Record<number, string> = {
  1: "text-destructive",
  2: "text-warning",
  3: "text-amber-400",
  4: "text-success",
};

export function PasswordStrength({ password }: { password: string }) {
  const { score, label } = getStrength(password);

  if (!password) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i < score ? COLOR_MAP[score] : "bg-secondary",
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs font-medium", TEXT_COLOR_MAP[score])}>
        {label}
      </p>
    </div>
  );
}
