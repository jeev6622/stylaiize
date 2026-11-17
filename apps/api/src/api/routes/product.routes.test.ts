import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { resetShoppingProvider } from "@/infrastructure/shopping/factory";

const app = createApp();

// Pin the demo catalog so these tests never depend on live shopping creds and
// never hit the network.
beforeEach(() => {
  env.SHOPPING_PROVIDER = "mock";
  resetShoppingProvider();
});

describe("GET /api/v1/products", () => {
  it("searches the catalog and reports that results are demo data", async () => {
    const res = await request(app).get("/api/v1/products?query=shirt");
    expect(res.status).toBe(200);
    expect(res.body.data.products.length).toBeGreaterThan(0);
    // The frontend relies on this flag to disclose sample data.
    expect(res.body.data.demoMode).toBe(true);
  });

  it("sorts by price ascending when asked", async () => {
    const res = await request(app).get(
      "/api/v1/products?query=shirt&sortBy=price_asc&limit=10",
    );
    expect(res.status).toBe(200);
    const prices = res.body.data.products.map((p: { price: number }) => p.price);
    const sorted = [...prices].sort((a: number, b: number) => a - b);
    expect(prices).toEqual(sorted);
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
  });

  it("returns 404 for an unknown product", async () => {
    const res = await request(app).get("/api/v1/products/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/products/compare", () => {
  it("flags the lowest price among compared products", async () => {
    const res = await request(app)
      .post("/api/v1/products/compare")
      .send({ productIds: ["prod-001", "prod-002"] });
    expect(res.status).toBe(200);
    const entries = res.body.data.entries as {
      product: { id: string; price: number };
      isLowestPrice: boolean;
    }[];
    expect(entries).toHaveLength(2);
    const lowest = Math.min(...entries.map((e) => e.product.price));
    entries
      .filter((e) => e.isLowestPrice)
      .forEach((e) => expect(e.product.price).toBe(lowest));
  });

  it("requires at least two products", async () => {
    const res = await request(app)
      .post("/api/v1/products/compare")
      .send({ productIds: ["prod-001"] });
    expect(res.status).toBe(422);
  });
});
