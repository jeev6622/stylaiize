import { cn } from "@/lib/utils";
import { APP_NAME } from "@stylaiize/shared";

type LogoSize = "xs" | "sm" | "md" | "lg";
type LogoTone = "default" | "light" | "dark";

const markSizes: Record<LogoSize, string> = {
  xs: "h-6 w-6 rounded-lg",
  sm: "h-8 w-8 rounded-xl",
  md: "h-9 w-9 rounded-xl",
  lg: "h-12 w-12 rounded-2xl",
};

const textSizes: Record<LogoSize, string> = {
  xs: "text-sm",
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};

const toneClasses: Record<LogoTone, { text: string; border: string; accent: string }> = {
  default: {
    text: "text-foreground",
    border: "border-white/20",
    accent: "text-aurora-subtle",
  },
  light: {
    text: "text-white",
    border: "border-white/25",
    accent: "text-amber-300",
  },
  dark: {
    text: "text-neutral-950",
    border: "border-neutral-200",
    accent: "text-violet-600",
  },
};

export function LogoMark({
  className,
  size = "md",
  tone = "default",
}: {
  className?: string;
  size?: LogoSize;
  tone?: LogoTone;
}) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden border bg-gradient-to-br from-violet-600 via-fuchsia-500 to-amber-400 shadow-[0_8px_24px_rgba(139,92,246,0.28)]",
        markSizes[size],
        toneClasses[tone].border,
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[72%] w-[72%]" aria-hidden="true">
        <path
          d="M16.8 7.4C15.4 6.1 13.5 5.4 11.3 5.4c-2.9 0-5 1.6-5 4 0 2.1 1.5 3.2 4.7 3.9l1.5.3c1.9.4 2.8 1 2.8 2 0 1.2-1.3 2-3.2 2-2.2 0-4-1-5.2-2.6"
          stroke="white"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M17.8 3.2l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" fill="#FDE68A" />
        <circle cx="18.2" cy="17.2" r="1.7" fill="#FDE68A" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  size = "md",
  tone = "default",
  showWordmark = true,
}: {
  className?: string;
  size?: LogoSize;
  tone?: LogoTone;
  showWordmark?: boolean;
}) {
  const tones = toneClasses[tone];

  return (
    <span className={cn("inline-flex items-center", showWordmark ? "gap-2.5" : "", className)}>
      <LogoMark size={size} tone={tone} />
      {showWordmark && (
        <span
          className={cn(
            "font-display text-xl font-semibold leading-none tracking-tight sm:tracking-[-0.02em]",
            textSizes[size],
            tones.text,
          )}
          aria-label={APP_NAME}
        >
          styl<span className={tones.accent}>AI</span>ze
        </span>
      )}
    </span>
  );
}
