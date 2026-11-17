import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable glassmorphism surface with optional hover elevation.
 */
export function GlassCard({
  className,
  children,
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn("glass rounded-2xl", hover && "glass-hover", className)}
      {...props}
    >
      {children}
    </div>
  );
}
