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
    const [local, domain] = input.to.split("@");
    const masked = local && domain ? `${local.charAt(0)}***@${domain}` : "***";
    logInfo(
      `[DEV EMAIL] Demo only, not delivered. To: ${masked} | Subject: ${input.subject} | Body omitted`,
    );
    return { success: true };
  }
}
