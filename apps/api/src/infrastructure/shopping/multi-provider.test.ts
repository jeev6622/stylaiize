import { describe, expect, it, vi } from "vitest";
import { NO_APPROVED_MENS_SHOPPING_PROVIDER_MESSAGE, type Product } from "@stylaiize/shared";
import { MultiShoppingProvider } from "./multi-provider";
import type { ShoppingProviderPort, ShoppingSearchResult } from "./shopping.interface";
import { ShoppingUnavailableError } from "./errors";

function product(id: string, price: number, buyUrl: string): Product {
  return {
    id,
    title: "Oxford Shirt",
    brand: "Studio Fit",
    imageUrl: null,
    price,
    originalPrice: null,
    currency: "INR",
    discountPercent: null,
    rating: null,
    reviewCount: null,
    store: "Store",
    deliveryEstimateDays: null,
    buyUrl,
    category: "tops",
    audience: "women",
    styleTags: ["western", "formal"],
    colors: [],
    sizes: [],
    inStock: true,
    priceVerifiedAt: "2026-11-19T05:00:00.000Z",
  };
}

function result(id: string, products: Product[]): ShoppingSearchResult {
  return {
    products,
    total: products.length,
    page: 1,
    totalPages: 1,
    source: "api",
    providerId: id,
    providerLabel: id,
    checkedAt: "2026-11-19T05:01:00.000Z",
  };
}

function provider(
  id: string,
  search: ShoppingProviderPort["search"],
  overrides: Partial<ShoppingProviderPort> = {},
): ShoppingProviderPort {
  return {
    id,
    label: id,
    isConfigured: true,
    demoMode: false,
    requiresCredentials: false,
    supportsPinCode: true,
    search,
    getById: async () => null,
    ...overrides,
  };
}

describe("multi shopping provider", () => {
  it("aggregates connected providers and removes duplicate listings", async () => {
    const shared = product("p-1", 1499, "https://example.com/shirt");
    const unique = product("p-2", 1299, "https://other.example/shirt");
    const multi = new MultiShoppingProvider([
      provider("a", async () => result("a", [shared])),
      provider("b", async () => result("b", [shared, unique])),
    ]);

    const search = await multi.search({ query: "oxford shirt", limit: 10 });
    expect(search.products).toHaveLength(2);
    expect(search.providerLabel).toContain("a");
    expect(search.providerLabel).toContain("b");
  });

  it("continues when one provider fails", async () => {
    const multi = new MultiShoppingProvider([
      provider("down", async () => {
        throw new Error("provider down");
      }),
      provider("up", async () => result("up", [product("p-3", 999, "https://example.com/p3")])),
    ]);

    const search = await multi.search({ query: "shirt" });
    expect(search.products).toHaveLength(1);
    const status = multi.describeProviders().find((entry) => entry.id === "down");
    expect(status?.connected).toBe(true);
    expect(status?.lastErrorAt).not.toBeNull();
  });

  it("throws the exact unavailable error when every provider fails", async () => {
    const multi = new MultiShoppingProvider([
      provider("down", async () => {
        throw new Error("provider down");
      }),
    ]);
    await expect(multi.search({ query: "shirt" })).rejects.toBeInstanceOf(
      ShoppingUnavailableError,
    );
  });

  it("does not pass PIN codes to providers that do not support them", async () => {
    const search = vi.fn(async () => result("no-pin", []));
    const multi = new MultiShoppingProvider([
      provider("no-pin", search, { supportsPinCode: false }),
    ]);
    await multi.search({ query: "shirt", pinCode: "560001" });
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ pinCode: undefined }));
  });

  it("caches repeated identical searches", async () => {
    const search = vi.fn(async () => result("cache", [product("p-4", 999, "https://example.com/p4")]));
    const multi = new MultiShoppingProvider([provider("cache", search)]);
    await multi.search({ query: "cached shirt" });
    await multi.search({ query: "cached shirt" });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("never returns men's products for a women's request", async () => {
    const mensProduct = {
      ...product("men-1", 999, "https://example.com/mens-shirt"),
      audience: "men" as Product["audience"],
    };
    const multi = new MultiShoppingProvider([
      provider("catalog", async () => result("catalog", [mensProduct])),
    ]);
    const search = await multi.search({ query: "shirt", audience: "women" });
    expect(search.products).toHaveLength(0);
  });

  it("never calls a women-only provider for a men's request and returns the exact notice", async () => {
    const search = vi.fn(async () =>
      result("women-only", [product("women-1", 999, "https://example.com/womens-shirt")]),
    );
    const multi = new MultiShoppingProvider([
      provider("women-only", search, { supportedAudiences: ["women"] }),
    ]);

    const response = await multi.search({ query: "men formal shirt", audience: "men" });

    expect(search).not.toHaveBeenCalled();
    expect(response.products).toEqual([]);
    expect(response.notice).toBe(NO_APPROVED_MENS_SHOPPING_PROVIDER_MESSAGE);
  });

  it("rejects products with an unknown audience for an explicit request", async () => {
    const unknown = { ...product("unknown-1", 999, "https://example.com/unknown"), audience: undefined };
    const multi = new MultiShoppingProvider([
      provider("catalog", async () => result("catalog", [unknown])),
    ]);

    const response = await multi.search({ query: "men shirt", audience: "men" });
    expect(response.products).toEqual([]);
  });

  it("applies requested style tags across providers", async () => {
    const formal = product("formal-1", 999, "https://example.com/formal");
    const casual = {
      ...product("casual-1", 899, "https://example.com/casual"),
      styleTags: ["casual"] as Product["styleTags"],
    };
    const multi = new MultiShoppingProvider([
      provider("catalog", async () => result("catalog", [formal, casual])),
    ]);
    const search = await multi.search({ query: "shirt", style: "formal" });
    expect(search.products.map((entry) => entry.id)).toEqual(["formal-1"]);
  });

  it("records rate-limit events in provider status", async () => {
    const multi = new MultiShoppingProvider([
      provider("limited", async () => result("limited", [])),
    ]);
    for (let index = 0; index < 61; index += 1) {
      await multi.search({ query: `rate limit ${index}` }).catch(() => undefined);
    }
    const status = multi.describeProviders().find((entry) => entry.id === "limited");
    expect(status?.rateLimitEvents).toBeGreaterThan(0);
    expect(status?.lastRateLimitedAt).not.toBeNull();
  });

  it("reports provider state and last successful sync time from real requests", async () => {
    const multi = new MultiShoppingProvider([
      provider("api", async () => result("api", [product("p-5", 999, "https://example.com/p5")])),
    ]);
    const before = multi.describeProviders().find((entry) => entry.id === "api");
    expect(before?.state).toBe("verification_pending");
    await multi.search({ query: "shirt", limit: 10 });
    const after = multi.describeProviders().find((entry) => entry.id === "api");
    expect(after?.state).toBe("connected");
    expect(after?.lastSuccessfulSyncAt).not.toBeNull();
  });
});
