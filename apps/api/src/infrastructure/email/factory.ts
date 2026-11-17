import { logInfo } from "@/utils/logger";
import { DevEmailProvider } from "./dev.email";
import type { EmailProviderPort } from "./email.interface";
import { SmtpEmailProvider } from "./smtp.email";

let cached: EmailProviderPort | null = null;

export function resolveEmailProvider(): EmailProviderPort {
  if (cached) return cached;
  const smtp = new SmtpEmailProvider();
  cached = smtp.isConfigured ? smtp : new DevEmailProvider();
  logInfo(
    `Email provider resolved: ${cached.demoMode ? "dev (logging)" : "smtp"}`,
  );
  return cached;
}

export function emailProviderStatus(): { active: boolean; demoMode: boolean } {
  const provider = resolveEmailProvider();
  return { active: !provider.demoMode, demoMode: provider.demoMode };
}

export function resetEmailProvider(): void {
  cached = null;
}
