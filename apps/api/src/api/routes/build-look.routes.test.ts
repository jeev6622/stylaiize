import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { z } from "zod";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { signAccessToken } from "@/utils/jwt";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { registerDemoFashionMemoryRepository } from "@/infrastructure/repos/fashion-memory.repo";
import { InMemoryFashionMemoryRepository } from "@/infrastructure/repos/memory/fashion-memory.memory.repo";
import { resetAIProvider } from "@/infrastructure/ai/factory";
import { AIService } from "@/application/services/ai.service";
import {
  GROOMING_CATEGORIES,
  NO_APPROVED_MENS_SHOPPING_PROVIDER_MESSAGE,
  type Product,
} from "@stylaiize/shared";
import { resetShoppingProvider } from "@/infrastructure/shopping/factory";
import { LivostyleFeedProvider } from "@/infrastructure/shopping/livostyle-feed.provider";

const app = createApp();

let token: string;
const originalProvider = env.AI_PROVIDER;
const originalShoppingProvider = env.SHOPPING_PROVIDER;

beforeAll(async () => {
  const users = new InMemoryUserRepository();
  registerDemoUserRepository(users);
  registerDemoFashionMemoryRepository(new InMemoryFashionMemoryRepository());

  const user = await users.create({
    name: "Build Look Tester",
    email: "build-look@example.com",
    emailVerified: true,
  });
  token = signAccessToken({ sub: user.id, role: "user" });

  env.AI_PROVIDER = "mock";
  resetAIProvider();
});

afterAll(() => {
  env.AI_PROVIDER = originalProvider;
  env.SHOPPING_PROVIDER = originalShoppingProvider;
  resetAIProvider();
  resetShoppingProvider();
});

function auth(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

const brief = {
  eventName: "Priya's engagement",
  audience: "women",
  occasion: "engagement",
  dressCode: "smart casual",
  style: "modern",
  budget: "10000",
};

describe("POST /api/v1/build-look/generate", () => {
  it("returns styling guidance with no invented product data and matching budget", async () => {
    const res = await request(app)
      .post("/api/v1/build-look/generate")
      .set(auth())
      .send(brief);

    expect(res.status).toBe(200);
    const look = res.body.data.look;
    expect(look.audience).toBe("women");
    expect(look.items.length).toBeGreaterThanOrEqual(4);
    expect(look.items.length).toBeLessThanOrEqual(7);
    for (const item of look.items) {
      expect(item.price).toBe(0);
      expect(item.originalPrice).toBe(0);
      expect(item.brand).toBeNull();
      expect(item.store).toBe("");
      expect(item.rating).toBe(0);
      expect(item.imageUrl).toBeNull();
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
    }
    expect(look.originalTotal).toBe(0);
    expect(look.optimizedTotal).toBe(0);
    expect(look.savings).toBe(0);
    expect(look.estimatedBudgetInr).toEqual({ min: 0, max: 10000, currency: "INR" });
    expect(typeof look.colorCombination).toBe("string");
    expect(look.colorCombination.length).toBeGreaterThan(0);
    expect(typeof look.footwear).toBe("string");
    expect(look.footwear.length).toBeGreaterThan(0);
    expect(Array.isArray(look.accessories)).toBe(true);
    expect(look.accessories.length).toBeGreaterThan(0);
    expect(typeof look.explanation).toBe("string");
    expect(look.explanation.length).toBeGreaterThan(0);

    const plan = res.body.data.grooming;
    expect(plan).toBeTruthy();
    expect(plan.items.length).toBeGreaterThanOrEqual(4);
    expect(plan.items.length).toBeLessThanOrEqual(6);
    for (const item of plan.items) {
      expect(GROOMING_CATEGORIES).toContain(item.category);
      expect(item.title).toBeTruthy();
    }
    expect(plan.summary).toBeTruthy();
  });

  it("omits grooming when includeGrooming is false", async () => {
    const res = await request(app)
      .post("/api/v1/build-look/generate")
      .set(auth())
      .send({ ...brief, includeGrooming: false });

    expect(res.status).toBe(200);
    expect(res.body.data.look.items.length).toBeGreaterThanOrEqual(4);
    expect("grooming" in res.body.data).toBe(false);
  });

  it("requires the audience before generation", async () => {
    const res = await request(app)
      .post("/api/v1/build-look/generate")
      .set(auth())
      .send({ ...brief, audience: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Select who this look is for.");
    expect(res.body.error.fieldErrors.audience).toContain("Select who this look is for.");
  });

  it("rejects invalid AI JSON via schema validation", async () => {
    const svc = new AIService({
      name: "mock",
      isConfigured: true,
      description: "test",
      async chat() {
        return { text: '{"not":"a look"}' };
      },
      async *stream() {
        yield "";
      },
    });
    const schema = z.object({ requiredField: z.string() }).strict();
    await expect(
      svc.generateJson(
        {
          task: "build_your_look",
          instruction: "x",
          outputSchema: { requiredField: "string" },
        },
        schema,
      ),
    ).rejects.toThrow(/AI returned invalid JSON for task "build_your_look"/);
  });
});

describe("POST /api/v1/build-look/shop", () => {
  const shopBrief = {
    audience: "women",
    items: [
      {
        itemId: "item-1",
        name: "Floral Midi Dress",
        category: "dresses",
        color: "pink",
      },
    ],
    budget: "5000",
  };

  const liveProduct: Product = {
    id: "livostyle-floral-midi-dress",
    title: "Floral Midi Dress",
    brand: "Livostyle",
    imageUrl: "https://cdn.shopify.com/dress.jpg",
    price: 3738,
    originalPrice: 5140,
    currency: "INR",
    discountPercent: 27,
    rating: 4.8,
    reviewCount: 12,
    store: "Livostyle",
    deliveryEstimateDays: null,
    buyUrl: "https://livostyle.com/products/floral-midi-dress",
    category: "Dresses",
    audience: "women",
    styleTags: ["western"],
    colors: ["Pink Floral"],
    sizes: ["S"],
    inStock: true,
    sourcePrice: { amount: 40, currency: "USD" },
    priceConverted: true,
    sourceLabel: "Livostyle open catalog (MIT)",
    priceVerifiedAt: "2026-11-19T05:00:00.000Z",
  };

  it("returns real listings for styling items", async () => {
    const search = vi.spyOn(LivostyleFeedProvider.prototype, "search").mockResolvedValue({
      products: [liveProduct],
      total: 1,
      page: 1,
      totalPages: 1,
      source: "api",
      fx: { base: "USD", quote: "INR", rate: 93.44, date: "2026-11-18" },
    });
    env.SHOPPING_PROVIDER = "livostyle";
    resetShoppingProvider();

    try {
      const res = await request(app)
        .post("/api/v1/build-look/shop")
        .set(auth())
        .send(shopBrief);
      expect(res.status).toBe(200);
      expect(res.body.data.matches).toHaveLength(1);
      expect(res.body.data.matches[0].status).toBe("found");
      expect(res.body.data.matches[0].product.id).toBe(liveProduct.id);
      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({ query: "floral midi dress pink", maxPrice: 5000 }),
      );
    } finally {
      search.mockRestore();
    }
  });

  it("accepts full outfit context and uses the generated per-item query", async () => {
    const search = vi.spyOn(LivostyleFeedProvider.prototype, "search").mockResolvedValue({
      products: [liveProduct],
      total: 1,
      page: 1,
      totalPages: 1,
      source: "api",
    });
    env.SHOPPING_PROVIDER = "livostyle";
    resetShoppingProvider();

    try {
      const res = await request(app)
        .post("/api/v1/build-look/shop")
        .set(auth())
        .send({
          audience: "women",
          occasion: "Friends Wedding",
          style: "modern",
          budget: "5000",
          items: [
            {
              ...shopBrief.items[0],
              audience: "women",
              style: "modern",
              query: "women's pink floral midi dress friends wedding modern under 5000 rupees",
            },
          ],
        });
      expect(res.status).toBe(200);
      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "women's pink floral midi dress friends wedding modern under 5000 rupees",
          audience: "women",
          maxPrice: 5000,
        }),
      );
    } finally {
      search.mockRestore();
    }
  });

  it("never returns men's products for a women's outfit item", async () => {
    const mensProduct: Product = {
      ...liveProduct,
      id: "mens-shirt",
      title: "Men's Formal Shirt",
      audience: "men",
      buyUrl: "https://livostyle.com/products/mens-formal-shirt",
    };
    const search = vi.spyOn(LivostyleFeedProvider.prototype, "search").mockResolvedValue({
      products: [mensProduct],
      total: 1,
      page: 1,
      totalPages: 1,
      source: "api",
    });
    env.SHOPPING_PROVIDER = "livostyle";
    resetShoppingProvider();

    try {
      const res = await request(app)
        .post("/api/v1/build-look/shop")
        .set(auth())
        .send({
          ...shopBrief,
          items: [{ ...shopBrief.items[0], audience: "women" }],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.matches[0].status).toBe("no_product");
      expect(res.body.data.matches[0].product).toBeNull();
    } finally {
      search.mockRestore();
    }
  });

  it("reports the exact unavailable message when the feed fails", async () => {
    const search = vi
      .spyOn(LivostyleFeedProvider.prototype, "search")
      .mockRejectedValue(new Error("feed down"));
    env.SHOPPING_PROVIDER = "livostyle";
    resetShoppingProvider();

    try {
      const res = await request(app)
        .post("/api/v1/build-look/shop")
        .set(auth())
        .send(shopBrief);
      expect(res.status).toBe(503);
      expect(res.body.error.message).toBe("Live product search is currently unavailable.");
    } finally {
      search.mockRestore();
    }
  });

  it("states that PIN-code availability must be confirmed when unsupported", async () => {
    const search = vi.spyOn(LivostyleFeedProvider.prototype, "search").mockResolvedValue({
      products: [liveProduct],
      total: 1,
      page: 1,
      totalPages: 1,
      source: "api",
      checkedAt: "2026-11-19T05:01:00.000Z",
    });
    env.SHOPPING_PROVIDER = "livostyle";
    resetShoppingProvider();

    try {
      const res = await request(app)
        .post("/api/v1/build-look/shop")
        .set(auth())
        .send({ ...shopBrief, pinCode: "560001" });
      expect(res.status).toBe(200);
      expect(res.body.data.pinCode).toBe("560001");
      expect(res.body.data.matches[0].availability.supported).toBe(false);
      expect(res.body.data.matches[0].availability.message).toBe(
        "Please confirm delivery availability on the retailer's website.",
      );
    } finally {
      search.mockRestore();
    }
  });

  it("returns the exact no-product message for an empty verified search", async () => {
    const search = vi.spyOn(LivostyleFeedProvider.prototype, "search").mockResolvedValue({
      products: [],
      total: 0,
      page: 1,
      totalPages: 0,
      source: "api",
    });
    env.SHOPPING_PROVIDER = "livostyle";
    resetShoppingProvider();

    try {
      const res = await request(app)
        .post("/api/v1/build-look/shop")
        .set(auth())
        .send(shopBrief);
      expect(res.status).toBe(200);
      expect(res.body.data.matches[0].status).toBe("no_product");
      expect(res.body.data.matches[0].product).toBeNull();
    } finally {
      search.mockRestore();
    }
  });

  it("returns the exact unavailable message for a men's look when no men-capable provider is configured", async () => {
    env.SHOPPING_PROVIDER = "livostyle";
    resetShoppingProvider();

    const res = await request(app)
      .post("/api/v1/build-look/shop")
      .set(auth())
      .send({
        audience: "men",
        items: [{ itemId: "item-1", name: "Linen Shirt", category: "upperwear", color: "Cream" }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.matches[0].status).toBe("no_product");
    expect(res.body.data.matches[0].reason).toBe(NO_APPROVED_MENS_SHOPPING_PROVIDER_MESSAGE);
  });

  it("rejects mismatched garment categories for a women's shirt item", async () => {
    const wrongProducts: Product[] = [
      {
        ...liveProduct,
        id: "dress-1",
        title: "Floral Midi Dress",
        category: "Dresses",
      },
      {
        ...liveProduct,
        id: "earrings-1",
        title: "Pearl Earrings",
        category: "Accessories",
      },
    ];
    const search = vi.spyOn(LivostyleFeedProvider.prototype, "search").mockResolvedValue({
      products: wrongProducts,
      total: wrongProducts.length,
      page: 1,
      totalPages: 1,
      source: "api",
    });
    env.SHOPPING_PROVIDER = "livostyle";
    resetShoppingProvider();

    try {
      const res = await request(app)
        .post("/api/v1/build-look/shop")
        .set(auth())
        .send({
          audience: "women",
          items: [{ itemId: "item-1", name: "Formal Shirt", category: "upperwear", color: "Cream" }],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.matches[0].status).toBe("no_product");
      expect(res.body.data.matches[0].product).toBeNull();
    } finally {
      search.mockRestore();
    }
  });
});

describe("POST /api/v1/build-look/complete-outfit-image", () => {
  const imageInput = {
    eventName: "Friends Wedding",
    audience: "men",
    style: "modern",
    items: [
      {
        id: "item-1",
        name: "Linen Shirt",
        category: "upperwear",
        color: "Cream",
      },
    ],
  };

  it("requires an explicit audience instead of returning Invalid input.", async () => {
    const res = await request(app)
      .post("/api/v1/build-look/complete-outfit-image")
      .set(auth())
      .send({ ...imageInput, audience: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Select who this look is for.");
    expect(res.body.error.message).not.toBe("Invalid input.");
  });

  it("accepts long season guidance without failing validation", async () => {
    const res = await request(app)
      .post("/api/v1/build-look/complete-outfit-image")
      .set(auth())
      .send({ ...imageInput, season: "late summer wedding season ".repeat(20).slice(0, 400) });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("error");
    expect(res.body.data.audience).toBe("men");
    expect(res.body.data.completeOutfitImage).toBeNull();
    expect(res.body.data.message).toContain("no valid verified product images");
  });
});
