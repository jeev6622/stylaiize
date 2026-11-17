import { logInfo } from "@/utils/logger";
import type { EmailInput, EmailProviderPort } from "./email.interface";

/** Demo/dev mailer - logs the email instead of sending. */
export class DevEmailProvider implements EmailProviderPort {
  readonly isConfigured = true;
  readonly demoMode = true;

  async send(input: EmailInput): Promise<void> {
    logInfo(`[DEV EMAIL] To: ${input.to} | Subject: ${input.subject}`, {
      text: input.text,
    });
  }
}
