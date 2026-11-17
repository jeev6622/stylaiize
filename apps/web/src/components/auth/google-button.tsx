"use client";

import { useEffect, useState } from "react";
import { API_ENDPOINTS } from "@stylaiize/shared";
import { apiClient, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("h-4 w-4", className)}>
      <path
        fill="#EA4335"
        d="M12 5.04c1.7 0 3.22.58 4.42 1.73l3.29-3.29C17.73 1.64 15.09.6 12 .6 7.39.6 3.42 3.24 1.49 7.1l3.84 2.98C6.25 7.31 8.87 5.04 12 5.04Z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h6.45a5.52 5.52 0 0 1-2.39 3.62l3.71 2.88c2.17-2 3.73-4.96 3.73-8.74Z"
      />
      <path
        fill="#FBBC05"
        d="M5.34 14.42a7.13 7.13 0 0 1 0-4.57L1.49 6.87a11.47 11.47 0 0 0 0 10.43l3.85-2.88Z"
      />
      <path
        fill="#34A853"
        d="M12 23.4c3.09 0 5.68-1.02 7.58-2.77l-3.71-2.88c-1.03.69-2.35 1.1-3.87 1.1-3.13 0-5.75-2.27-6.67-5.04l-3.84 2.98C3.42 20.76 7.39 23.4 12 23.4Z"
      />
    </svg>
  );
}

interface AuthConfig {
  emailLogin: boolean;
  googleLogin: boolean;
  demoMode: boolean;
}

/**
 * "Continue with Google" button.
 * Hidden when Google OAuth is not configured (demo mode); clicking it
 * starts the authorization-code flow on the API, which redirects back
 * to /auth/callback with tokens.
 */
export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<AuthConfig>(API_ENDPOINTS.auth.config, { skipAuth: true })
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        // If the config endpoint is unreachable assume defaults (email only).
        if (!cancelled) setConfig({ emailLogin: true, googleLogin: false, demoMode: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config?.googleLogin) return null;

  return (
    <Button variant="outline" className="w-full" asChild>
      <a href={`${API_BASE_URL}${API_ENDPOINTS.auth.google}`}>
        <GoogleIcon />
        {label}
      </a>
    </Button>
  );
}
