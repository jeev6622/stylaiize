import { logInfo } from "@/utils/logger";
import type {
  EmailInput,
  EmailProviderPort,
  EmailSendResult,
} from "./email.interface";

/** Demo/dev mailer - logs a redacted summary instead of sending or exposing OTPs. */
export class DevEmailProvider implements EmailProviderPort {
  readonly isConfigured = true;
  readonly demoMode = true;

  async send(input: EmailInput): Promise<EmailSendResult> {
    logInfo(
      `[DEV EMAIL] Demo only, not delivered. To: ${input.to} | Subject: ${input.subject} | Body omitted`,
    );
    return { success: true };
  }
}
