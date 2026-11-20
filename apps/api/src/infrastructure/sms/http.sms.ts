import { env } from "@/config/env";
import { logWarn } from "@/utils/logger";
import type { SMSInput, SMSProviderPort, SMSSendResult } from "./sms.interface";

const DEFAULT_TEMPLATE = {
  to: "{{to}}",
  message: "{{message}}",
  senderId: "{{senderId}}",
};

function parseJsonObject(raw: string): Record<string, string> | null {
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string") return null;
      result[key] = value;
    }
    return result;
  } catch {
    return null;
  }
}

function render(value: string, values: Record<string, string>): string {
  return value.replace(/\{\{(to|message|otp|senderId)\}\}/g, (_match, key: string) => values[key] ?? "");
}

function deepRender(value: unknown, values: Record<string, string>): unknown {
  if (typeof value === "string") return render(value, values);
  if (Array.isArray(value)) return value.map((item) => deepRender(item, values));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) result[key] = deepRender(item, values);
    return result;
  }
  return value;
}

export class HttpSmsProvider implements SMSProviderPort {
  readonly demoMode = false;
  private readonly template: Record<string, unknown>;
  private readonly headers: Record<string, string>;
  private readonly url: string;

  constructor() {
    this.url = env.SMS_API_URL.trim();
    const parsedTemplate = parseJsonObject(env.SMS_API_PAYLOAD_TEMPLATE || JSON.stringify(DEFAULT_TEMPLATE));
    const parsedHeaders = parseJsonObject(env.SMS_API_HEADERS_JSON);
    this.template = parsedTemplate ?? DEFAULT_TEMPLATE;
    this.headers = parsedHeaders ?? {};
    if (!parsedTemplate || !parsedHeaders) {
      logWarn("[SMS] Invalid SMS template or headers configuration. Check SMS_API_PAYLOAD_TEMPLATE and SMS_API_HEADERS_JSON.");
    }
  }

  get isConfigured(): boolean {
    return this.url.length > 0;
  }

  async send(input: SMSInput): Promise<SMSSendResult> {
    if (!this.isConfigured) {
      return { success: false, error: "SMS gateway is not configured." };
    }

    const otp = input.body.match(/\b\d{6}\b/)?.[0] ?? "";
    const values = {
      to: input.to,
      message: input.body,
      otp,
      senderId: env.SMS_SENDER_ID,
    };
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...this.headers,
      ...(env.SMS_API_KEY ? { Authorization: `Bearer ${env.SMS_API_KEY}` } : {}),
    };

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify(deepRender(this.template, values)),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return { success: false, error: `SMS gateway rejected the request (${response.status}).` };
      }
      return { success: true };
    } catch (error) {
      logWarn("[SMS] Gateway request failed", {
        reason: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      });
      return { success: false, error: "SMS gateway could not be reached." };
    }
  }
}
