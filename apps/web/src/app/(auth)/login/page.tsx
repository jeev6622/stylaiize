"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { GoogleButton } from "@/components/auth/google-button";
import { CountryCodeSelect } from "@/components/auth/country-code-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const OAUTH_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in is not configured on this deployment.",
};

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loginMode, setLoginMode] = useState<"email" | "mobile">("email");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const oauthError = searchParams.get("error");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (loginMode === "email") {
        await login({ email: email.trim(), password, rememberMe });
      } else {
        await login({ countryCode, mobile: mobile.trim(), password, rememberMe });
      }
      toast.success("Welcome back!");
      router.push("/chat");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      toast.error(message);
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
        <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to keep styling — your wardrobe is waiting.
        </p>

        {oauthError && (
          <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {OAUTH_ERRORS[oauthError] ?? "Sign-in failed. Please try again."}
          </p>
        )}

        <Tabs value={loginMode} onValueChange={(v) => setLoginMode(v as "email" | "mobile")} className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="email" className="flex-1">Email</TabsTrigger>
            <TabsTrigger value="mobile" className="flex-1">Mobile</TabsTrigger>
          </TabsList>

          <TabsContent value="email">
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
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
              <PasswordField
                password={password}
                setPassword={setPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
              />
              <SubmitButton submitting={submitting} />
            </form>
          </TabsContent>

          <TabsContent value="mobile">
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="mobile-login">Mobile number</Label>
                <div className="flex gap-2">
                  <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
                  <Input
                    id="mobile-login"
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
              <PasswordField
                password={password}
                setPassword={setPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
              />
              <SubmitButton submitting={submitting} />
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-input bg-secondary/40 accent-primary"
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-primary hover:underline underline-offset-4">
            Forgot password?
          </Link>
        </div>

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

function PasswordField({
  password,
  setPassword,
  showPassword,
  setShowPassword,
}: {
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="password">Password</Label>
      </div>
      <div className="relative">
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="pr-10"
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
    </div>
  );
}

function SubmitButton({ submitting }: { submitting: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={submitting}>
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
      Sign in
    </Button>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
