"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { GoogleButton } from "@/components/auth/google-button";
import { CountryCodeSelect } from "@/components/auth/country-code-select";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api";
import { redirectAfterLogin } from "@/lib/auth-redirect";
import { useAuth } from "@/lib/auth";

type LoginMethod = "code" | "password";
type PasswordMode = "email" | "mobile";
type CodeStep = "email" | "verify";

const OAUTH_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in is not configured on this deployment.",
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function EmailOtpLogin() {
  const { login, sendLoginOtp, loginWithOtp } = useAuth();
  const searchParams = useSearchParams();

  const [method, setMethod] = useState<LoginMethod>("code");
  const [codeStep, setCodeStep] = useState<CodeStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("email");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const oauthError = searchParams.get("error");

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const normalized = email.trim();
    if (!normalized) {
      toast.error("Enter your email address to continue.");
      return;
    }
    setSubmitting(true);
    try {
      await sendLoginOtp(normalized);
      setCodeStep("verify");
      setCountdown(60);
      toast.success("If an account exists, a sign-in code is on its way.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not send a sign-in code. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      await loginWithOtp(email.trim(), otp, rememberMe);
      toast.success("Welcome back!");
      redirectAfterLogin(searchParams);
    } catch (err) {
      setOtp("");
      toast.error(errorMessage(err, "That code is invalid or has expired."));
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (submitting || countdown > 0) return;
    setSubmitting(true);
    try {
      await sendLoginOtp(email.trim());
      setCountdown(60);
      setOtp("");
      toast.success("If an account exists, a new code is on its way.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not resend the code. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  function handleChangeEmail() {
    setCodeStep("email");
    setOtp("");
    setCountdown(0);
  }

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (passwordMode === "email") {
        await login({ email: email.trim(), password, rememberMe });
      } else {
        await login({ countryCode, mobile: mobile.trim(), password, rememberMe });
      }
      toast.success("Welcome back!");
      redirectAfterLogin(searchParams);
    } catch (err) {
      toast.error(errorMessage(err, "Sign-in failed. Please try again."));
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard className="p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to keep styling. Your wardrobe is waiting.
        </p>

        {oauthError && (
          <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {OAUTH_ERRORS[oauthError] ?? "Sign-in failed. Please try again."}
          </p>
        )}

        <Tabs value={method} onValueChange={(value) => setMethod(value as LoginMethod)} className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="code" className="flex-1 gap-2">
              <Mail className="h-4 w-4" />
              Email code
            </TabsTrigger>
            <TabsTrigger value="password" className="flex-1 gap-2">
              <KeyRound className="h-4 w-4" />
              Password
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="mt-6">
            {codeStep === "email" ? (
              <form onSubmit={handleSendCode} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="otp-email">Email address</Label>
                  <Input
                    id="otp-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Continue with Email
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4" noValidate>
                <div className="rounded-xl bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                  Enter the 6-digit code sent to{" "}
                  <span className="font-medium text-foreground">{email.trim()}</span>.
                </div>
                <div className="space-y-2">
                  <Label>Verification code</Label>
                  <OtpInput value={otp} onChange={setOtp} disabled={submitting} />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-input bg-secondary/40 accent-primary"
                  />
                  Keep me signed in
                </label>
                <Button type="submit" className="w-full" disabled={submitting || otp.length !== 6}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  Verify and sign in
                </Button>
                <div className="flex items-center justify-between gap-3 text-sm">
                  {countdown > 0 ? (
                    <p className="text-muted-foreground">
                      Resend in <span className="font-medium text-foreground">{countdown}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={submitting}
                      className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Resend code
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleChangeEmail}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Change email
                  </button>
                </div>
              </form>
            )}

            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                <div>
                  <p className="font-medium text-foreground">Phone code</p>
                  <p>Available when an SMS provider is approved.</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                Unavailable
              </span>
            </div>
          </TabsContent>

          <TabsContent value="password" className="mt-6">
            <PasswordLoginForm
              email={email}
              setEmail={setEmail}
              passwordMode={passwordMode}
              setPasswordMode={setPasswordMode}
              countryCode={countryCode}
              setCountryCode={setCountryCode}
              mobile={mobile}
              setMobile={setMobile}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              rememberMe={rememberMe}
              setRememberMe={setRememberMe}
              submitting={submitting}
              onSubmit={handlePasswordLogin}
            />
          </TabsContent>
        </Tabs>

        <div className="my-6 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <GoogleButton />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to StylAIze?{" "}
          <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          <Link href="/forgot-email" className="hover:underline underline-offset-4">
            Forgot email?
          </Link>
        </p>
      </GlassCard>
    </motion.div>
  );
}

interface PasswordLoginFormProps {
  email: string;
  setEmail: (value: string) => void;
  passwordMode: PasswordMode;
  setPasswordMode: (value: PasswordMode) => void;
  countryCode: string;
  setCountryCode: (value: string) => void;
  mobile: string;
  setMobile: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  submitting: boolean;
  onSubmit: (event: FormEvent) => Promise<void>;
}

function PasswordLoginForm({
  email,
  setEmail,
  passwordMode,
  setPasswordMode,
  countryCode,
  setCountryCode,
  mobile,
  setMobile,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  rememberMe,
  setRememberMe,
  submitting,
  onSubmit,
}: PasswordLoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Tabs value={passwordMode} onValueChange={(value) => setPasswordMode(value as PasswordMode)}>
        <TabsList className="w-full">
          <TabsTrigger value="email" className="flex-1">Email</TabsTrigger>
          <TabsTrigger value="mobile" className="flex-1">Mobile</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4">
          <div className="space-y-2">
            <Label htmlFor="password-email">Email</Label>
            <Input
              id="password-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </TabsContent>

        <TabsContent value="mobile" className="mt-4">
          <div className="space-y-2">
            <Label htmlFor="password-mobile">Mobile number</Label>
            <div className="flex gap-2">
              <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
              <Input
                id="password-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="9876543210"
                value={mobile}
                onChange={(event) => setMobile(event.target.value.replace(/\D/g, ""))}
                className="flex-1"
                required
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <PasswordField
        password={password}
        setPassword={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
      />

      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-input bg-secondary/40 accent-primary"
          />
          Remember me
        </label>
        <Link href="/forgot-password" className="text-primary hover:underline underline-offset-4">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Sign in with password
      </Button>
    </form>
  );
}

function PasswordField({
  password,
  setPassword,
  showPassword,
  setShowPassword,
}: {
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="password">Password</Label>
      <div className="relative">
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="pr-10"
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
