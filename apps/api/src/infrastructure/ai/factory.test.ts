import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/config/env";
import {
  aiProviderStatus,
  getAIProviderName,
  isMockAI,
  resetAIProvider,
  resolveAIProvider,
} from "@/infrastructure/ai/factory";
import { AINotConfiguredError } from "@/infrastructure/ai/errors";

// `env` is a parsed in-process object; mutating AI_PROVIDER lets us exercise
// each resolution branch in a fresh vitest worker (module state is per-file).
const original = env.AI_PROVIDER;

afterEach(() => {
  env.AI_PROVIDER = original;
  resetAIProvider();
});

describe("AI provider resolution", () => {
  it("selects mock only when explicitly pinned", () => {
    env.AI_PROVIDER = "mock";
    expect(resolveAIProvider().name).toBe("mock");
    expect(aiProviderStatus()).toEqual({ active: "mock", demoMode: true, configured: true });
    expect(isMockAI()).toBe(true);
  });

  it("never falls back to mock when a real provider is pinned but unconfigured", () => {
    env.AI_PROVIDER = "gemini";
    expect(() => resolveAIProvider()).toThrow(AINotConfiguredError);
    expect(isMockAI()).toBe(false);
    // Status stays honest instead of claiming a healthy fallback.
    expect(aiProviderStatus().configured).toBe(false);
    expect(aiProviderStatus().active).toBe("gemini");
  });

  it("reports none when no credentials exist and nothing is pinned", () => {
    env.AI_PROVIDER = "";
    expect(isMockAI()).toBe(false);
    const status = aiProviderStatus();
    expect(status.active).toBe("none");
    expect(status.configured).toBe(false);
    expect(getAIProviderName()).toBe("none");
  });
});