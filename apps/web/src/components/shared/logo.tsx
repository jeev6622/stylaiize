import { cn } from "@/lib/utils";
import { APP_NAME } from "@stylaiize/shared";

export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-12 w-12",
  };
  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  };
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative grid place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 shadow-glow",
          sizes[size],
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-[55%] w-[55%] text-white"
          aria-hidden
        >
          <path
            d="M12 3l7 3v5c0 4.4-3 8.6-7 10-4-1.4-7-5.6-7-10V6l7-3z"
            fill="currentColor"
            opacity="0.9"
          />
          <path
            d="M8.5 12l2.2 2.2 4.8-4.8"
            stroke="#0b0f1a"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={cn(
          "font-display font-semibold tracking-tight text-foreground",
          textSizes[size],
        )}
      >
        {APP_NAME}
        <span className="text-aurora-subtle">.</span>
      </span>
    </span>
  );
}
