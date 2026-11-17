import type { AIProvider } from "@stylaiize/shared";
import { env } from "@/config/env";
import { logInfo, logWarn } from "@/utils/logger";
import { AINotConfiguredError } from "./errors";
import { GeminiProvider } from "./gemini.provider";
import { MockProvider } from "./mock.provider";
import {
  GemmaProvider,
  LlamaProvider,
  OpenAIProvider,
  QwenProvider,
} from "./openai-compatible.provider";
import type { AIProviderPort } from "./provider.interface";

const PROVIDERS: Record<string, AIProviderPort> = {
  gemini: new GeminiProvider(),
  openai: OpenAIProvider,
  qwen: QwenProvider,
  llama: LlamaProvider,
  gemma: GemmaProvider,
  mock: new MockProvider(),
};

const PRIORITY: AIProvider[] = ["gemini", "openai", "qwen", "llama", "gemma"];

let cached: AIProviderPort | null = null;

/** Every real provider that currently has usable credentials. */
function configuredProviders(): AIProvider[] {
  return PRIORITY.filter((name) => PROVIDERS[name]?.isConfigured);
}

/**
 * Resolves the active AI provider.
 *
 * Order:
 *  1. `AI_PROVIDER=mock`            -> deterministic demo provider (explicit opt-in only)
 *  2. `AI_PROVIDER=<real provider>` -> that provider; THROWS if it has no credentials
 *  3. first configured real provider
 *  4. otherwise -> THROWS `AINotConfiguredError`
 *
 * The mock provider is never selected implicitly. A pinned-but-unconfigured
 * provider is a configuration error, not a reason to serve fake data, so it
 * throws instead of caching a provider that cannot answer.
 */
export function resolveAIProvider(): AIProviderPort {
  if (cached) return cached;

  const pinned = env.AI_PROVIDER.trim().toLowerCase();

  if (pinned === "mock") {
    cached = PROVIDERS.mock;
    logWarn(
      "AI provider resolved: mock (AI_PROVIDER=mock). All AI responses are DEMO DATA, not real AI.",
    );
    return cached;
  }

  // `AI_PROVIDER` is an enum in the env schema, so an unknown value cannot
  // reach here; the empty string is the only non-match.
  const pinnedProvider = pinned ? PROVIDERS[pinned] : undefined;

  if (pinnedProvider) {
    if (!pinnedProvider.isConfigured) {
      // Do not cache: a later env reload / key rotation should be able to fix
      // this without restarting, and the status endpoint must stay honest.
      throw new AINotConfiguredError(pinned);
    }
    cached = pinnedProvider;
  } else {
    const firstConfigured = configuredProviders()[0];
    if (!firstConfigured) {
      throw new AINotConfiguredError(pinned || "any");
    }
    cached = PROVIDERS[firstConfigured];
  }

  logInfo(`AI provider resolved: ${cached.name} (${cached.description})`);
  return cached;
}

/**
 * Non-throwing status probe used by /health and /auth/config.
 * Reports what *would* be used without failing when nothing is configured.
 */
export function aiProviderStatus(): {
  active: AIProvider | "none";
  demoMode: boolean;
  configured: boolean;
} {
  const pinned = env.AI_PROVIDER.trim().toLowerCase();

  if (pinned === "mock") {
    return { active: "mock", demoMode: true, configured: true };
  }

  // A pinned provider is authoritative even when it is unconfigured, so the
  // status must not claim a healthy fallback that requests will never use.
  if (pinned) {
    const provider = PROVIDERS[pinned];
    if (!provider) return { active: "none", demoMode: false, configured: false };
    return {
      active: provider.name,
      demoMode: false,
      configured: provider.isConfigured,
    };
  }

  const available = configuredProviders();
  if (available.length > 0) {
    return { active: available[0], demoMode: false, configured: true };
  }

  return { active: "none", demoMode: false, configured: false };
}

/** True when the app is intentionally running on demo data. */
export function isMockAI(): boolean {
  try {
    return resolveAIProvider().name === "mock";
  } catch {
    return false;
  }
}

export function getAIProviderName(): AIProvider | "none" {
  return aiProviderStatus().active;
}

/** Human-readable description of a named provider, for status/health output. */
export function describeProvider(name: string): string {
  const provider = PROVIDERS[name];
  if (provider) return provider.description;
  return "No AI provider is configured. Set GEMINI_API_KEY (or another provider key) in .env.";
}

/** Reset the resolved provider (used in tests). */
export function resetAIProvider(): void {
  cached = null;
}
