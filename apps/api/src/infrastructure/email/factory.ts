import { isDemoModeAllowed } from "@/config/features";
import { logInfo } from "@/utils/logger";
import { DevEmailProvider } from "./dev.email";
import type { EmailProviderPort, EmailSendResult } from "./email.interface";
import { SmtpEmailProvider } from "./smtp.email";

const NOT_CONFIGURED =
  "Email delivery is not configured. Set SMTP_HOST or enable ALLOW_DEMO_MODE.";

const disabledProvider: EmailProviderPort = {
  isConfigured: false,
  demoMode: false,
  async send(): Promise<EmailSendResult> {
    return { success: false, error: NOT_CONFIGURED };
  },
};

let cached: EmailProviderPort | null = null;

export function resolveEmailProvider(): EmailProviderPort {
  if (cached) return cached;
  const smtp = new SmtpEmailProvider();
  if (smtp.isConfigured) {
    cached = smtp;
  } else if (isDemoModeAllowed()) {
    cached = new DevEmailProvider();
  } else {
    cached = disabledProvider;
  }
  logInfo(
    `Email provider resolved: ${cached.demoMode ? "dev (demo, not delivered)" : cached.isConfigured ? "smtp" : "disabled"}`,
  );
  return cached;
}

export function emailProviderStatus(): { active: boolean; demoMode: boolean } {
  const provider = resolveEmailProvider();
  return {
    active: provider.isConfigured && !provider.demoMode,
    demoMode: provider.demoMode,
  };
}

export function resetEmailProvider(): void {
  cached = null;
}

export function registerEmailProviderForTests(provider: EmailProviderPort | null): void {
  cached = provider ?? null;
}
