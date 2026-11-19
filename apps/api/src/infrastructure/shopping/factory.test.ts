import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/config/env";
import {
  resolveShoppingProvider,
  shoppingProviderStatus,
  resetShoppingProvider,
} from "@/infrastructure/shopping/factory";
import { ShoppingNotConfiguredError } from "@/infrastructure/shopping/errors";

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
    expect(shoppingProviderStatus().activeProviderId).toBe("mock");
  });

  it("refuses to fall back to demo results when the live catalog is pinned but unconfigured", () => {
    env.SHOPPING_ENABLED = false;
    env.SHOPPING_PROVIDER = "real";
    resetShoppingProvider();
    expect(() => resolveShoppingProvider()).toThrow(ShoppingNotConfiguredError);
    expect(shoppingProviderStatus().active).toBe("none");
    expect(shoppingProviderStatus().activeProviderId).toBeNull();
    expect(shoppingProviderStatus().configured).toBe(false);
  });

  it("uses the free live catalog when nothing is pinned", () => {
    env.SHOPPING_ENABLED = false;
    env.SHOPPING_PROVIDER = "";
    resetShoppingProvider();
    const provider = resolveShoppingProvider();
    expect(provider.isConfigured).toBe(true);
    expect(provider.demoMode).toBe(false);
    expect(shoppingProviderStatus().active).toBe("real");
    expect(shoppingProviderStatus().activeProviderId).toBe("livostyle");
    expect(shoppingProviderStatus().configured).toBe(true);
  });

  it("uses the free live catalog when explicitly pinned to livostyle", () => {
    env.SHOPPING_PROVIDER = "livostyle";
    resetShoppingProvider();
    const provider = resolveShoppingProvider();
    expect(provider.isConfigured).toBe(true);
    expect(provider.demoMode).toBe(false);
    expect(shoppingProviderStatus().activeProviderId).toBe("livostyle");
  });
});
