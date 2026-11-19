import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/config/env";
import {
  emailProviderStatus,
  resetEmailProvider,
  resolveEmailProvider,
} from "@/infrastructure/email/factory";

const originalDemo = env.ALLOW_DEMO_MODE;
const originalNodeEnv = env.NODE_ENV;
const originalSmtpHost = env.SMTP_HOST;

afterEach(() => {
  env.ALLOW_DEMO_MODE = originalDemo;
  env.NODE_ENV = originalNodeEnv;
  env.SMTP_HOST = originalSmtpHost;
  resetEmailProvider();
});

describe("Email provider resolution", () => {
  it("uses the dev provider only with an explicit demo opt-in", async () => {
    env.NODE_ENV = "production";
    env.SMTP_HOST = "";
    env.ALLOW_DEMO_MODE = true;
    const provider = resolveEmailProvider();
    expect(provider.demoMode).toBe(true);
    expect(emailProviderStatus()).toEqual({ active: false, demoMode: true });
    const result = await provider.send({ to: "user@example.com", subject: "Code", text: "123456" });
    expect(result.success).toBe(true);
  });

  it("reports failure instead of claiming delivery when SMTP is unconfigured", async () => {
    env.NODE_ENV = "production";
    env.SMTP_HOST = "";
    env.ALLOW_DEMO_MODE = false;
    const provider = resolveEmailProvider();
    expect(provider.isConfigured).toBe(false);
    expect(emailProviderStatus()).toEqual({ active: false, demoMode: false });

    const result = await provider.send({ to: "user@example.com", subject: "Code", text: "123456" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not configured/i);
  });
});
