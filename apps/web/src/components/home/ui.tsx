"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export function useStartStylingHref(): string {
  const { status } = useAuth();
  return status === "authenticated" ? "/build-look" : "/register";
}

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Eyebrow({
  index,
  label,
  tone = "dark",
}: {
  index: string;
  label: string;
  tone?: "dark" | "light";
}) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={cn(
          "font-editorial text-[11px] tracking-[0.4em]",
          tone === "dark" ? "text-neutral-400" : "text-white/45",
        )}
      >
        {index}
      </span>
      <span
        className={cn(
          "h-px w-14 bg-gradient-to-r from-amber-500/70 to-transparent",
          tone === "light" && "from-amber-300/70",
        )}
      />
      <span
        className={cn(
          "text-[11px] font-medium uppercase tracking-[0.35em]",
          tone === "dark" ? "text-neutral-500" : "text-white/60",
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function EditorialLink({
  href,
  children,
  tone = "dark",
  className,
}: {
  href: string;
  children: ReactNode;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-[13px] font-medium uppercase tracking-[0.2em] transition-colors duration-300",
        tone === "dark"
          ? "bg-neutral-900 text-white hover:bg-neutral-700"
          : "bg-white text-neutral-900 hover:bg-amber-100",
        className,
      )}
    >
      {children}
      <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
        &rarr;
      </span>
    </Link>
  );
}
