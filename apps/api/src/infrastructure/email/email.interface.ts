export interface EmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Optional SMTP envelope customization. */
  replyTo?: string;
}

export interface EmailProviderPort {
  readonly isConfigured: boolean;
  readonly demoMode: boolean;
  send(input: EmailInput): Promise<void>;
}
