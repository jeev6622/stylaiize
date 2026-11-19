import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "@/config/env";
import { logError } from "@/utils/logger";
import type {
  EmailInput,
  EmailProviderPort,
  EmailSendResult,
} from "./email.interface";

export class SmtpEmailProvider implements EmailProviderPort {
  readonly demoMode = false;
  private transporter: Transporter | null = null;

  get isConfigured(): boolean {
    return env.SMTP_HOST.trim().length > 0;
  }

  private getTransporter(): Transporter | null {
    if (!this.isConfigured) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth:
          env.SMTP_USER && env.SMTP_PASS
            ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
            : undefined,
      });
    }
    return this.transporter;
  }

  async send(input: EmailInput): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return { success: false, error: "SMTP is not configured." };
    }
    try {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        replyTo: input.replyTo,
      });
      return { success: true };
    } catch (err) {
      logError("SMTP send failed", err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
