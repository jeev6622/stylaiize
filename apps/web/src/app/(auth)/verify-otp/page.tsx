"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from "@/lib/api";
import { redirectAfterLogin } from "@/lib/auth-redirect";
import { API_ENDPOINTS } from "@stylaiize/shared";

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const purpose = searchParams.get("purpose") ?? "email_verification";
  const target = searchParams.get("target") ?? "";

  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP.");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post(
        API_ENDPOINTS.auth.verifyOtp,
        { target, code: otp, purpose },
        { skipAuth: true },
      );
      toast.success("Verification successful!");
      if (purpose === "email_verification") {
        redirectAfterLogin(searchParams);
      } else if (purpose === "password_reset") {
        router.push(`/forgot-password?step=reset&target=${encodeURIComponent(target)}&code=${otp}`);
      } else {
        router.push("/login");
      }
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Invalid OTP. Please try again.";
      toast.error(message);
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!canResend) return;
    try {
      await apiClient.post(
        API_ENDPOINTS.auth.sendOtp,
        { purpose, email: target },
        { skipAuth: true },
      );
      toast.success("A new verification code has been requested.");
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not resend OTP. Try again.";
      toast.error(message);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard className="p-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Verify your code</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 6-digit code sent to{" "}
          <span className="font-medium text-foreground">{target}</span>
        </p>

        <form onSubmit={onVerify} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label>Verification code</Label>
            <OtpInput value={otp} onChange={setOtp} disabled={submitting} />
          </div>

          <Button type="submit" className="w-full" disabled={submitting || otp.length !== 6}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Verify
          </Button>
        </form>

        <div className="mt-4 text-center">
          {canResend ? (
            <button
              onClick={handleResend}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline underline-offset-4"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Resend OTP
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Resend OTP in <span className="font-medium text-foreground">{countdown}s</span>
            </p>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </GlassCard>
    </motion.div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpForm />
    </Suspense>
  );
}
