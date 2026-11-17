"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/**
 * Animated aurora background.
 * Renders drifting color blobs over a mesh grid + dot grid.
 */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 bg-background" />
      <div className="mesh-grid absolute inset-0" />
      <div className="dot-grid absolute inset-0" />
      <motion.div
        className="aurora-blob left-[-10%] top-[-15%] h-[45rem] w-[45rem] bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.55),transparent_65%)]"
        animate={{ x: [0, 60, -40, 0], y: [0, 40, -50, 0], scale: [1, 1.12, 0.95, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="aurora-blob right-[-12%] top-[10%] h-[38rem] w-[38rem] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.4),transparent_65%)]"
        animate={{ x: [0, -50, 40, 0], y: [0, 60, -30, 0], scale: [1, 0.9, 1.15, 1] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="aurora-blob bottom-[-20%] left-[20%] h-[42rem] w-[42rem] bg-[radial-gradient(circle_at_center,rgba(217,70,239,0.42),transparent_65%)]"
        animate={{ x: [0, 40, -60, 0], y: [0, -40, 30, 0], scale: [1, 1.08, 0.92, 1] }}
        transition={{ duration: 29, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="aurora-blob bottom-[5%] right-[15%] h-[28rem] w-[28rem] bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.28),transparent_65%)]"
        animate={{ x: [0, -30, 50, 0], y: [0, 50, -40, 0], scale: [1, 1.1, 0.94, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
    </div>
  );
}
