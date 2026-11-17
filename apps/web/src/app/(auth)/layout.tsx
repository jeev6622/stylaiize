import type { ReactNode } from "react";
import Link from "next/link";
import { AuroraBackground } from "@/components/shared/aurora-background";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <AuroraBackground />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="StylAIze home">
            <Logo />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
