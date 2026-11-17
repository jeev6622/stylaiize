import { env } from "@/config/env";
import { logInfo } from "@/utils/logger";
import { RealShoppingProvider } from "./real-shopping.provider";
import { MockShoppingProvider } from "./mock-shopping.provider";
import { ShoppingNotConfiguredError } from "./errors";
import type { ShoppingProviderPort } from "./shopping.interface";

let cached: ShoppingProviderPort | null = null;

/**
 * Resolution order:
 *  1. `SHOPPING_PROVIDER=mock` -> demo catalog (explicit, demoMode = true)
 *  2. `SHOPPING_PROVIDER=real` -> live catalog, THROWS `ShoppingNotConfiguredError`
 *     when credentials are missing so we never serve mock products as real
 *  3. unpinned -> live catalog if configured, otherwise demo catalog
 */
export function resolveShoppingProvider(): ShoppingProviderPort {
  if (cached) return cached;
  const real = new RealShoppingProvider();
  const pinned = env.SHOPPING_PROVIDER;

  if (pinned === "mock") {
    cached = new MockShoppingProvider();
  } else if (pinned === "real") {
    if (!real.isConfigured) throw new ShoppingNotConfiguredError();
    cached = real;
  } else {
    cached = real.isConfigured ? real : new MockShoppingProvider();
  }

  logInfo(
    `Shopping provider resolved: ${cached.demoMode ? "mock" : "real"}` +
      (cached.demoMode
        ? " (demo catalog - results are sample data, not live listings)"
        : ""),
  );
  return cached;
}

export function shoppingProviderStatus(): {
  active: "real" | "mock" | "none";
  demoMode: boolean;
  configured: boolean;
} {
  const configured = Boolean(env.SHOPPING_ENABLED) && env.SHOPPING_API_URL.trim().length > 0;
  const active: "real" | "mock" | "none" =
    env.SHOPPING_PROVIDER === "real" && !configured
      ? "none"
      : env.SHOPPING_PROVIDER === "mock" || !configured
        ? "mock"
        : "real";
  return { active, demoMode: active === "mock", configured };
}

export function resetShoppingProvider(): void {
  cached = null;
}
