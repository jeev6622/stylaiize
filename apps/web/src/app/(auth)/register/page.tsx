"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, Eye, EyeOff, Loader2, Mail, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { isValidEmail, isValidPassword, maskMobile, normalizeIndianMobile } from "@stylaiize/shared";
import { GlassCard } from "@/components/shared/glass-card";
import { GoogleButton } from "@/components/auth/google-button";
import { OtpInput } from "@/components/auth/otp-input";
import { PasswordStrength } from "@/components/auth/password-strength";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { redirectAfterLogin } from "@/lib/auth-redirect";
import { useAuth, type StartRegistrationResult, type VerificationChannel } from "@/lib/auth";

type VerificationState =
  | "idle"
  | "sending"
  | "sent"
  | "verifying"
  | "verified"
  | "expired"
  | "incorrect"
  | "error";

const STATE_LABELS: Record<VerificationState, string> = {
  idle: "Waiting to send",
  sending: "Sending code",
  sent: "Code sent",
  verifying: "Verifying code",
  verified: "Verified",
  expired: "Code expired",
  incorrect: "Incorrect code",
  error: "Could not send code",
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}

function errorCode(error: unknown): string {
  return error instanceof ApiError ? error.code : "";
}

export default function RegisterPage() {
  const {
    startRegistration,
    resendRegistrationOtp,
    verifyRegistrationOtp,
    completeRegistration,
  } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [registration, setRegistration] = useState<StartRegistrationResult | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [mobileCode, setMobileCode] = useState("");
  const [emailState, setEmailState] = useState<VerificationState>("idle");
  const [mobileState, setMobileState] = useState<VerificationState>("idle");
  const [emailMessage, setEmailMessage] = useState("");
  const [mobileMessage, setMobileMessage] = useState("");
  const [emailResendIn, setEmailResendIn] = useState(0);
  const [mobileResendIn, setMobileResendIn] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [successful, setSuccessful] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (emailResendIn > 0) setEmailResendIn((value) => Math.max(0, value - 1));
      if (mobileResendIn > 0) setMobileResendIn((value) => Math.max(0, value - 1));
      if (expiresAt && Date.now() >= expiresAt) {
        if (emailState !== "verified") setEmailState("expired");
        if (mobileState !== "verified") setMobileState("expired");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailResendIn, mobileResendIn, expiresAt, emailState, mobileState]);

  async function handleDetails(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const normalizedMobile = normalizeIndianMobile(mobile);
    if (name.trim().length < 2) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (!normalizedMobile) {
      toast.error("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!isValidPassword(password)) {
      toast.error("Use 8 or more characters with uppercase, lowercase, a digit, and a symbol.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await startRegistration({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        mobile: normalizedMobile,
        countryCode: "+91",
      });
      setRegistration(result);
      setEmailState("sent");
      setMobileState("sent");
      setEmailMessage("We sent a six-digit code to your email.");
      setMobileMessage("We sent a six-digit code to your mobile number.");
      setExpiresAt(new Date(result.expiresAt).getTime());
      setEmailResendIn(60);
      setMobileResendIn(60);
      toast.success("Verification codes sent.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(channel: VerificationChannel) {
    if (!registration) return;
    const code = channel === "email" ? emailCode : mobileCode;
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the six-digit code.");
      return;
    }

    const setStatus = channel === "email" ? setEmailState : setMobileState;
    const setMessage = channel === "email" ? setEmailMessage : setMobileMessage;
    setStatus("verifying");
    setMessage("Checking your code.");
    try {
      const result = await verifyRegistrationOtp(registration.registrationId, channel, code);
      setStatus("verified");
      setMessage(channel === "email" ? "Email verified." : "Mobile number verified.");
      if (channel === "email") setEmailResendIn(0);
      else setMobileResendIn(0);
      if (result.bothVerified) toast.success("Email and mobile verified. Your account is ready.");
    } catch (error) {
      const failureCode = errorCode(error);
      if (failureCode === "OTP_EXPIRED") {
        setStatus("expired");
        setMessage("That code expired. Request a new one.");
      } else {
        setStatus("incorrect");
        setMessage("That code is incorrect. Check it and try again.");
      }
      toast.error(errorMessage(error));
    }
  }

  async function handleResend(channel: VerificationChannel) {
    if (!registration) return;
    const seconds = channel === "email" ? emailResendIn : mobileResendIn;
    if (seconds > 0) return;

    const setStatus = channel === "email" ? setEmailState : setMobileState;
    const setMessage = channel === "email" ? setEmailMessage : setMobileMessage;
    const setCountdown = channel === "email" ? setEmailResendIn : setMobileResendIn;
    const setCode = channel === "email" ? setEmailCode : setMobileCode;

    setStatus("sending");
    setMessage("Sending a new code.");
    try {
      const result = await resendRegistrationOtp(registration.registrationId, channel);
      setStatus("sent");
      setMessage("A new code is on its way.");
      setCode("");
      setCountdown(Math.ceil((new Date(result.resendAvailableAt).getTime() - Date.now()) / 1000));
      toast.success("New verification code sent.");
    } catch (error) {
      setStatus("error");
      setMessage("We could not send the code. Please try again.");
      toast.error(errorMessage(error));
    }
  }

  async function handleComplete() {
    if (!registration || completing) return;
    if (emailState !== "verified" || mobileState !== "verified") return;

    setCompleting(true);
    try {
      await completeRegistration(registration.registrationId);
      setSuccessful(true);
      toast.success("Registration complete. Welcome to StylAIze.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setCompleting(false);
    }
  }

  function verificationBlock(
    channel: VerificationChannel,
    state: VerificationState,
    message: string,
    code: string,
    setCode: (value: string) => void,
    seconds: number,
    icon: ReactNode,
    title: string,
    detail: string,
  ) {
    const verified = state === "verified";
    const busy = state === "sending" || state === "verifying";
    return (
      <div
        className={cn(
          "rounded-2xl border p-4 transition-colors",
          verified
            ? "border-emerald-400/40 bg-emerald-400/5"
            : state === "expired" || state === "incorrect" || state === "error"
              ? "border-rose-400/40 bg-rose-400/5"
              : "border-white/10 bg-white/[0.02]",
        )}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-amber-300">
            {verified ? <BadgeCheck className="h-4 w-4 text-emerald-300" /> : icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{title}</p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  verified
                    ? "bg-emerald-400/15 text-emerald-300"
                    : state === "expired" || state === "incorrect" || state === "error"
                      ? "bg-rose-400/15 text-rose-300"
                      : "bg-white/10 text-muted-foreground",
                )}
              >
                {STATE_LABELS[state]}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
            <p className="mt-1 text-xs text-muted-foreground">{message}</p>

            {!verified && (
              <div className="mt-3 space-y-3">
                <OtpInput value={code} onChange={setCode} disabled={busy} />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleVerify(channel)}
                    disabled={busy || !/^\d{6}$/.test(code)}
                  >
                    {state === "verifying" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Verify {channel}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleResend(channel)}
                    disabled={busy || seconds > 0}
                  >
                    {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (successful) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard className="p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
            <Check className="h-7 w-7" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold">Registration successful</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your email and mobile number are verified. Your StylAIze account is ready.
          </p>
          <Button className="mt-6 w-full" onClick={() => redirectAfterLogin()}>
            Continue to dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full text-xs font-semibold",
              registration ? "bg-white/10 text-muted-foreground" : "bg-amber-400 text-neutral-950",
            )}
          >
            1
          </span>
          <span className="h-px flex-1 bg-white/10" />
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full text-xs font-semibold",
              registration ? "bg-amber-400 text-neutral-950" : "bg-white/10 text-muted-foreground",
            )}
          >
            2
          </span>
          <span className="text-xs text-muted-foreground">Verify</span>
        </div>

        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">
          {registration ? "Verify your details" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {registration
            ? "Enter both codes to secure your StylAIze account."
            : "Five styled outfits for your next event, in under a minute."}
        </p>

        {!registration ? (
          <form onSubmit={handleDetails} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                autoComplete="name"
                placeholder="Aarav Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile number</Label>
              <div className="flex gap-2">
                <span className="inline-flex h-10 w-[74px] shrink-0 items-center justify-center rounded-md border border-input bg-secondary/40 text-sm">
                  +91
                </span>
                <Input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="flex-1"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">Enter a 10-digit Indian mobile number.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
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
                  onClick={() => setShowConfirm((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Send verification codes
            </Button>
          </form>
        ) : (
          <div className="mt-6 space-y-3">
            {verificationBlock(
              "email",
              emailState,
              emailMessage,
              emailCode,
              setEmailCode,
              emailResendIn,
              <Mail className="h-4 w-4" />,
              "Email address",
              registration.email,
            )}
            {verificationBlock(
              "mobile",
              mobileState,
              mobileMessage,
              mobileCode,
              setMobileCode,
              mobileResendIn,
              <Smartphone className="h-4 w-4" />,
              "Mobile number",
              `+91 ${maskMobile(registration.mobile)}`,
            )}

            <Button
              type="button"
              className="w-full"
              onClick={() => void handleComplete()}
              disabled={completing || emailState !== "verified" || mobileState !== "verified"}
            >
              {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Create account
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Codes expire five minutes after they are sent.
            </p>
          </div>
        )}

        {!registration && (
          <>
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <GoogleButton label="Sign up with Google" />
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </GlassCard>
    </motion.div>
  );
}
