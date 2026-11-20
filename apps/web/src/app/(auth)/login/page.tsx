"use client";

import { Suspense } from "react";
import { EmailOtpLogin } from "@/components/auth/email-otp-login";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <EmailOtpLogin />
    </Suspense>
  );
}
