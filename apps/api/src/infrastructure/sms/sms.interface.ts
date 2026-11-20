export interface SMSInput {
  to: string;
  body: string;
}

export interface SMSSendResult {
  success: boolean;
  error?: string;
}

export interface SMSProviderPort {
  readonly isConfigured: boolean;
  readonly demoMode: boolean;
  send(input: SMSInput): Promise<SMSSendResult>;
}
