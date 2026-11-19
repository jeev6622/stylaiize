import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Product } from "@stylaiize/shared";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { registerDemoSavedOutfitRepository } from "@/infrastructure/repos/saved-outfit.repo";
import { InMemorySavedOutfitRepository } from "@/infrastructure/repos/memory/saved-outfit.memory.repo";
import { registerDemoWardrobeRepository } from "@/infrastructure/repos/wardrobe.repo";
import { InMemoryWardrobeRepository } from "@/infrastructure/repos/memory/wardrobe.memory.repo";
import { getProductById } from "@/application/services/product.service";
import { resetShoppingProvider } from "@/infrastructure/shopping/factory";
import { signAccessToken } from "@/utils/jwt";

const app = createApp();

let userRepository: InMemoryUserRepository;
let token: string;
let product: Product;

const originalShoppingProvider = env.SHOPPING_PROVIDER;

beforeAll(async () => {
  env.SHOPPING_PROVIDER = "mock";
  resetShoppingProvider();
  product = (await getProductById("prod-001"))!;
  userRepository = new InMemoryUserRepository();
  registerDemoUserRepository(userRepository);
  registerDemoSavedOutfitRepository(new InMemorySavedOutfitRepository());
  registerDemoWardrobeRepository(new InMemoryWardrobeRepository());
});

afterAll(() => {
  env.SHOPPING_PROVIDER = originalShoppingProvider;
  resetShoppingProvider();
});

beforeEach(async () => {
  env.SHOPPING_PROVIDER = "mock";
  resetShoppingProvider();
  userRepository = new InMemoryUserRepository();
  registerDemoUserRepository(userRepository);
  registerDemoSavedOutfitRepository(new InMemorySavedOutfitRepository());
  registerDemoWardrobeRepository(new InMemoryWardrobeRepository());

  const user = await userRepository.create({
    name: "Fav Tester",
    email: "fav@example.com",
    emailVerified: true,
  });
  token = signAccessToken({ sub: user.id, role: "user" });
});

function auth(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe("GET /api/v1/account/favourites", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/account/favourites");
    expect(res.status).toBe(401);
  });

  it("returns empty favourites by default, flagged as demo data", async () => {
    const res = await request(app).get("/api/v1/account/favourites").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.favourites).toEqual([]);
    expect(res.body.data.demoMode).toBe(true);
  });
});

describe("POST /api/v1/account/favourites", () => {
  it("saves a favourite and it persists after re-fetch", async () => {
    const save = await request(app)
      .post("/api/v1/account/favourites")
      .set(auth())
      .send({ product });
    expect(save.status).toBe(201);
    expect(save.body.data.favourites).toHaveLength(1);
    expect(save.body.data.favourites[0].id).toBe("prod-001");

    const list = await request(app).get("/api/v1/account/favourites").set(auth());
    expect(list.status).toBe(200);
    expect(list.body.data.favourites).toHaveLength(1);
    expect(list.body.data.favourites[0].title).toBe(product.title);

    const summary = await request(app).get("/api/v1/account").set(auth());
    expect(summary.status).toBe(200);
    expect(summary.body.data.stats.favourites).toBe(1);
  });

  it("rejects product data that does not match the provider snapshot", async () => {
    const res = await request(app)
      .post("/api/v1/account/favourites")
      .set(auth())
      .send({ product: { ...product, price: 1 } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PRODUCT_MISMATCH");
  });

  it("rejects product ids the provider cannot confirm", async () => {
    const res = await request(app)
      .post("/api/v1/account/favourites")
      .set(auth())
      .send({ product: { ...product, id: "unknown-product" } });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects invalid product URLs", async () => {
    const res = await request(app)
      .post("/api/v1/account/favourites")
      .set(auth())
      .send({
        product: {
          ...product,
          buyUrl: "javascript:alert(1)",
        },
      });
    expect(res.status).toBe(422);
  });

  it("rejects unauthorized access", async () => {
    const res = await request(app)
      .post("/api/v1/account/favourites")
      .send({ product });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/v1/account/favourites/:id", () => {
  it("removes a saved favourite", async () => {
    await request(app).post("/api/v1/account/favourites").set(auth()).send({ product });

    const del = await request(app)
      .delete("/api/v1/account/favourites/prod-001")
      .set(auth());
    expect(del.status).toBe(200);
    expect(del.body.data.favourites).toEqual([]);

    const list = await request(app).get("/api/v1/account/favourites").set(auth());
    expect(list.body.data.favourites).toEqual([]);
  });
});
