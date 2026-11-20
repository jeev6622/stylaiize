"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuroraBackground } from "@/components/shared/aurora-background";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { redirectAfterLogin } from "@/lib/auth-redirect";
import { useAuth } from "@/lib/auth";

function CallbackHandler() {
  const { adoptTokens } = useAuth();
  const searchParams = useSearchParams();
  const [failed, setFailed] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    const error = searchParams.get("error");

    if (error || !accessToken || !refreshToken) {
      setFailed(
        error
          ? decodeURIComponent(error).replace(/_/g, " ")
          : "Sign-in was cancelled or incomplete.",
      );
      return;
    }

    adoptTokens(accessToken, refreshToken)
      .then(() => {
        redirectAfterLogin(searchParams);
      })
      .catch(() => setFailed("We signed you in but could not load your profile."));
  }, [adoptTokens, searchParams]);

  if (failed) {
    return (
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Sign-in failed</h1>
        <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {failed}
        </p>
        <Button className="mt-6" asChild>
          <a href="/login">Back to sign in</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <AuroraBackground />
      <div className="relative z-10 flex flex-col items-center gap-8">
        <Logo />
        <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-primary" />}>
          <CallbackHandler />
        </Suspense>
      </div>
    </div>
  );
}
