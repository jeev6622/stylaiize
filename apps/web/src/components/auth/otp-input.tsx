"use client";

import { useRef, useCallback, type KeyboardEvent, type ClipboardEvent } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split("").concat(Array(6 - value.length).fill(""));

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  };

  const handleChange = (index: number, digit: string) => {
    if (disabled) return;
    if (!/^\d*$/.test(digit)) return;

    const newValue = digits.map((d, i) => (i === index ? digit : d)).join("");
    onChange(newValue.slice(0, 6));

    if (digit && index < 5) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        const newValue = digits.map((d, i) => (i === index - 1 ? "" : d)).join("");
        onChange(newValue);
        focusInput(index - 1);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      focusInput(index - 1);
    } else if (e.key === "ArrowRight" && index < 5) {
      focusInput(index + 1);
    }
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (pasted) {
        onChange(pasted);
        const nextIndex = Math.min(pasted.length, 5);
        focusInput(nextIndex);
      }
    },
    [disabled, onChange],
  );

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digits[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-12 w-10 rounded-xl border border-input bg-secondary/40 text-center text-lg font-semibold text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      ))}
    </div>
  );
}
