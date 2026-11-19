import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { NO_APPROVED_MENS_SHOPPING_PROVIDER_MESSAGE, type Product } from "@stylaiize/shared";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { resetShoppingProvider } from "@/infrastructure/shopping/factory";
import { RealShoppingProvider } from "@/infrastructure/shopping/real-shopping.provider";

const app = createApp();

// Pin the demo catalog so these tests never depend on live shopping creds and
// never hit the network.
beforeEach(() => {
  env.SHOPPING_PROVIDER = "mock";
  resetShoppingProvider();
});

describe("GET /api/v1/products", () => {
  it("refuses to show mock products as verified search results", async () => {
    const res = await request(app).get("/api/v1/products?query=shirt");
    expect(res.status).toBe(503);
    expect(res.body.error?.code).toBe("SHOPPING_UNAVAILABLE");
  });

  it("sorts verified live products by price ascending when asked", async () => {
    const base: Product = {
      id: "live-shirt-1",
      title: "Cream Formal Shirt",
      brand: "Test Brand",
      imageUrl: "https://example.com/images/shirt.jpg",
      price: 1999,
      originalPrice: null,
      currency: "INR",
      discountPercent: null,
      rating: 4.2,
      reviewCount: 10,
      store: "Test Store",
      deliveryEstimateDays: null,
      buyUrl: "https://example.com/p/shirt-1",
      category: "upperwear",
      audience: "men",
      colors: ["Cream"],
      sizes: ["M"],
      inStock: true,
      priceVerifiedAt: "2026-01-01T00:00:00.000Z",
    };
    const products = [
      base,
      { ...base, id: "live-shirt-2", price: 999, buyUrl: "https://example.com/p/shirt-2" },
    ];
    const configured = vi
      .spyOn(RealShoppingProvider.prototype, "isConfigured", "get")
      .mockReturnValue(true);
    const search = vi
      .spyOn(RealShoppingProvider.prototype, "search")
      .mockImplementation(async () => ({
        products,
        total: products.length,
        page: 1,
        totalPages: 1,
        source: "api",
        sourceLabel: "Test Store",
        checkedAt: "2026-01-01T00:00:00.000Z",
      }));
    env.SHOPPING_PROVIDER = "real";
    resetShoppingProvider();

    try {
      const res = await request(app).get(
        "/api/v1/products?query=shirt&sortBy=price_asc&limit=10",
      );
      expect(res.status).toBe(200);
      const prices = res.body.data.products.map((p: { price: number }) => p.price);
      expect(prices).toEqual([999, 1999]);
      expect(res.body.data.demoMode).toBe(false);
    } finally {
      configured.mockRestore();
      search.mockRestore();
      resetShoppingProvider();
    }
  });

  it("returns the exact unavailable message for men's searches without a men-capable provider", async () => {
    env.SHOPPING_PROVIDER = "livostyle";
    resetShoppingProvider();

    const res = await request(app).get(
      "/api/v1/products?query=men%20formal%20shirt&audience=men",
    );

    expect(res.status).toBe(200);
    expect(res.body.data.products).toEqual([]);
    expect(res.body.data.notice).toBe(NO_APPROVED_MENS_SHOPPING_PROVIDER_MESSAGE);
  });

  it("rejects an empty query and an unknown sort option", async () => {
    expect((await request(app).get("/api/v1/products?query=")).status).toBe(422);
    expect(
      (await request(app).get("/api/v1/products?query=shirt&sortBy=bogus")).status,
    ).toBe(422);
  });
});

describe("GET /api/v1/products/:id", () => {
  it("returns a catalog product", async () => {
    const res = await request(app).get("/api/v1/products/prod-001");
    expect(res.status).toBe(200);
    expect(res.body.data.product.title).toContain("Shirt");
    expect(res.body.data.demoMode).toBe(true);
  });

  it("returns 404 for an unknown product", async () => {
    const res = await request(app).get("/api/v1/products/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/products/compare", () => {
  it("rejects comparing demo products honestly", async () => {
    const res = await request(app)
      .post("/api/v1/products/compare")
      .send({ productIds: ["prod-001", "prod-002"] });
    expect(res.status).toBe(422);
    expect(res.body.error?.code).toBe("INCOMPARABLE_PRODUCTS");
  });

  it("ranks genuinely comparable live products", async () => {
    const base: Product = {
      id: "live-1",
      title: "Slim Fit Spread Collar Shirt",
      brand: "Allen Solly",
      imageUrl: "https://example.com/shirt.jpg",
      price: 1499,
      originalPrice: 2299,
      currency: "INR",
      discountPercent: 35,
      rating: 4.3,
      reviewCount: 1284,
      store: "Myntra",
      deliveryEstimateDays: { min: 3, max: 5 },
      buyUrl: "https://example.com/shirt-1",
      category: "tops",
      colors: ["White"],
      sizes: ["M", "L"],
      inStock: true,
    };
    const products: Product[] = [
      base,
      { ...base, id: "live-2", price: 999, rating: 4.6, buyUrl: "https://example.com/shirt-2" },
    ];

    const configured = vi
      .spyOn(RealShoppingProvider.prototype, "isConfigured", "get")
      .mockReturnValue(true);
    const getById = vi
      .spyOn(RealShoppingProvider.prototype, "getById")
      .mockImplementation(async (id) => products.find((p) => p.id === id) ?? null);
    env.SHOPPING_PROVIDER = "real";
    resetShoppingProvider();

    try {
      const res = await request(app)
        .post("/api/v1/products/compare")
        .send({ productIds: ["live-1", "live-2"] });
      expect(res.status).toBe(200);
      const entries: Array<{
        product: { id: string };
        isLowestPrice: boolean;
        isHighestRated: boolean;
        isBestValue: boolean;
      }> = res.body.data.entries;
      expect(entries).toHaveLength(2);
      const cheapest = entries.find((e) => e.product.id === "live-2");
      expect(cheapest?.isLowestPrice).toBe(true);
      expect(cheapest?.isHighestRated).toBe(true);
      expect(cheapest?.isBestValue).toBe(true);
      expect(entries.find((e) => e.product.id === "live-1")?.isLowestPrice).toBe(false);
    } finally {
      configured.mockRestore();
      getById.mockRestore();
      resetShoppingProvider();
    }
  });

  it("requires at least two products", async () => {
    const res = await request(app)
      .post("/api/v1/products/compare")
      .send({ productIds: ["prod-001"] });
    expect(res.status).toBe(422);
  });
});

describe("GET /api/v1/products/shopping-status", () => {
  it("reports connected providers and credential requirements", async () => {
    const res = await request(app).get("/api/v1/products/shopping-status");
    expect(res.status).toBe(200);
    const ids = res.body.data.providers.map((entry: { id: string }) => entry.id);
    expect(ids).toContain("livostyle");
    expect(ids).toContain("amazon_in");
    expect(ids).toContain("flipkart");
    expect(ids).toContain("myntra");
    expect(ids).toContain("ajio");
    expect(
      res.body.data.providers.find((entry: { id: string }) => entry.id === "livostyle"),
    ).toMatchObject({ supportedAudiences: ["women"] });
    expect(
      res.body.data.providers.find((entry: { id: string }) => entry.id === "amazon_in"),
    ).toMatchObject({
      connected: false,
      requiresCredentials: true,
      state: "approval_required",
    });
    for (const id of ["myntra", "ajio"]) {
      expect(
        res.body.data.providers.find((entry: { id: string }) => entry.id === id),
      ).toMatchObject({ state: "approval_required" });
    }
  });
});
