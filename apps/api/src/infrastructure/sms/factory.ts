import { HttpSmsProvider } from "./http.sms";
import type { SMSProviderPort } from "./sms.interface";

export const SMS_DELIVERY_UNAVAILABLE =
  "SMS delivery is not configured. Configure an approved SMS gateway before registering with a mobile number.";

const unavailableProvider: SMSProviderPort = {
  isConfigured: false,
  demoMode: false,
  async send() {
    return { success: false, error: SMS_DELIVERY_UNAVAILABLE };
  },
};

let cached: SMSProviderPort | null = null;

export function resolveSmsProvider(): SMSProviderPort {
  if (cached) return cached;
  const httpProvider = new HttpSmsProvider();
  cached = httpProvider.isConfigured ? httpProvider : unavailableProvider;
  return cached;
}

export function smsProviderStatus(): { active: boolean; demoMode: boolean } {
  return { active: resolveSmsProvider().isConfigured, demoMode: false };
}

export function resetSmsProvider(): void {
  cached = null;
}

export function registerSmsProviderForTests(provider: SMSProviderPort | null): void {
  cached = provider ?? null;
}
