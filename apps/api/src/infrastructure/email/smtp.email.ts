import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "@/config/env";
import { isSmtpConfigured } from "@/config/features";
import { logError } from "@/utils/logger";
import type { EmailInput, EmailProviderPort } from "./email.interface";

export class SmtpEmailProvider implements EmailProviderPort {
  readonly demoMode = false;
  private transporter: Transporter | null = null;

  get isConfigured(): boolean {
    return isSmtpConfigured;
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

  async send(input: EmailInput): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) return;
    try {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        replyTo: input.replyTo,
      });
    } catch (err) {
      logError("SMTP send failed", err);
      throw err;
    }
  }
}
