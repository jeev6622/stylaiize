import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/config/env";
import {
  resolveShoppingProvider,
  shoppingProviderStatus,
  resetShoppingProvider,
} from "@/infrastructure/shopping/factory";
import { ShoppingNotConfiguredError } from "@/infrastructure/shopping/errors";

// `env` is a parsed in-process object; mutating SHOPPING_PROVIDER exercises
// each resolution branch in a fresh vitest worker (module state is per-file).
const original = env.SHOPPING_PROVIDER;

afterEach(() => {
  env.SHOPPING_PROVIDER = original;
  resetShoppingProvider();
});

describe("Shopping provider resolution", () => {
  it("selects the demo catalog only when explicitly pinned to mock", () => {
    env.SHOPPING_PROVIDER = "mock";
    const provider = resolveShoppingProvider();
    expect(provider.demoMode).toBe(true);
    expect(shoppingProviderStatus().demoMode).toBe(true);
  });

  it("refuses to fall back to demo results when the live catalog is pinned but unconfigured", () => {
    env.SHOPPING_ENABLED = false;
    env.SHOPPING_PROVIDER = "real";
    resetShoppingProvider();
    expect(() => resolveShoppingProvider()).toThrow(ShoppingNotConfiguredError);
    // Status stays honest: it reports "none" rather than a healthy mock.
    expect(shoppingProviderStatus().active).toBe("none");
    expect(shoppingProviderStatus().configured).toBe(false);
  });

  it("falls back to the demo catalog when nothing is pinned, and marks it as demo", () => {
    env.SHOPPING_ENABLED = false;
    env.SHOPPING_PROVIDER = "";
    resetShoppingProvider();
    const provider = resolveShoppingProvider();
    expect(provider.demoMode).toBe(true);
    expect(shoppingProviderStatus().active).toBe("mock");
  });
});
