"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, Send } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PasswordStrength } from "@/components/auth/password-strength";
import { OtpInput } from "@/components/auth/otp-input";
import { CountryCodeSelect } from "@/components/auth/country-code-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiClient, ApiError } from "@/lib/api";
import { API_ENDPOINTS } from "@stylaiize/shared";

type Step = "identifier" | "otp" | "reset";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("identifier");
  const [identifierType, setIdentifierType] = useState<"email" | "mobile">("email");
  const [identifier, setIdentifier] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [target, setTarget] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const id = identifierType === "email" ? identifier.trim() : `${countryCode}${mobile.trim()}`;
    try {
      await apiClient.post(
        API_ENDPOINTS.auth.forgotPassword,
        identifierType === "email"
          ? { identifier: id }
          : { identifier: `${countryCode}${mobile.trim()}` },
        { skipAuth: true },
      );
      setTarget(id);
      setStep("otp");
      toast.success("OTP sent successfully.");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
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
        { target, code: otp, purpose: "password_reset" },
        { skipAuth: true },
      );
      setStep("reset");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Invalid OTP. Please try again.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!PASSWORD_REGEX.test(newPassword)) {
      toast.error("Password must be at least 8 characters with uppercase, lowercase, number, and special character.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(
        API_ENDPOINTS.auth.resetPassword,
        { target, code: otp, password: newPassword, confirmPassword },
        { skipAuth: true },
      );
      toast.success("Password reset successfully! Please sign in.");
      router.push("/login");
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
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {step === "identifier" && "Reset your password"}
          {step === "otp" && "Verify OTP"}
          {step === "reset" && "Set new password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === "identifier" && "Enter your email or mobile number to receive a verification code."}
          {step === "otp" && `We sent a code to ${target}`}
          {step === "reset" && "Create a new strong password for your account."}
        </p>

        {step === "identifier" && (
          <form onSubmit={handleSendOtp} className="mt-6 space-y-4" noValidate>
            <Tabs value={identifierType} onValueChange={(v) => setIdentifierType(v as "email" | "mobile")}>
              <TabsList className="w-full">
                <TabsTrigger value="email" className="flex-1">Email</TabsTrigger>
                <TabsTrigger value="mobile" className="flex-1">Mobile</TabsTrigger>
              </TabsList>

              <TabsContent value="email">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email address</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                </div>
              </TabsContent>

              <TabsContent value="mobile">
                <div className="space-y-2">
                  <Label htmlFor="forgot-mobile">Mobile number</Label>
                  <div className="flex gap-2">
                    <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
                    <Input
                      id="forgot-mobile"
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
              </TabsContent>
            </Tabs>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send OTP
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <Label>Verification code</Label>
              <OtpInput value={otp} onChange={setOtp} disabled={submitting} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting || otp.length !== 6}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Verify
            </Button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={handleResetPassword} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Min 8 chars, upper, lower, digit, special"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrength password={newPassword} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirm-new-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reset password
            </Button>
          </form>
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
