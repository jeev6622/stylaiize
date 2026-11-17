"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { CountryCodeSelect } from "@/components/auth/country-code-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from "@/lib/api";
import { API_ENDPOINTS } from "@stylaiize/shared";

interface ForgotEmailResponse {
  success: boolean;
  maskedEmail?: string;
}

export default function ForgotEmailPage() {
  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const data = await apiClient.post<ForgotEmailResponse>(
        API_ENDPOINTS.auth.forgotEmail,
        { countryCode, mobile: mobile.trim() },
        { skipAuth: true },
      );
      setMaskedEmail(data.maskedEmail ?? null);
      setSubmitted(true);
      toast.success("Request processed.");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard className="p-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Find your email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your mobile number and we will help you find your account.
        </p>

        {!submitted ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="find-email-mobile">Mobile number</Label>
              <div className="flex gap-2">
                <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
                <Input
                  id="find-email-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  className="flex-1"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Find email
            </Button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            {maskedEmail && (
              <div className="rounded-xl bg-secondary/50 px-4 py-3 text-center">
                <p className="text-sm text-muted-foreground">We found this email:</p>
                <p className="mt-1 font-medium text-foreground">{maskedEmail}</p>
              </div>
            )}
            <p className="text-center text-sm text-muted-foreground">
              If an account exists with this number, an email has been sent with further instructions.
            </p>
          </div>
        )}

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
