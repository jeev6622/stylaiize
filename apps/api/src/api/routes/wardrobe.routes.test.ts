import { afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { registerDemoWardrobeRepository } from "@/infrastructure/repos/wardrobe.repo";
import { InMemoryWardrobeRepository } from "@/infrastructure/repos/memory/wardrobe.memory.repo";
import { signAccessToken } from "@/utils/jwt";
import type { WardrobeItem } from "@stylaiize/shared";

const app = createApp();

let userRepository: InMemoryUserRepository;
let token: string;
let userId: string;

beforeAll(async () => {
  userRepository = new InMemoryUserRepository();
  registerDemoUserRepository(userRepository);
  registerDemoWardrobeRepository(new InMemoryWardrobeRepository());

  const user = await userRepository.create({
    name: "Tester",
    email: "wardrobe@example.com",
    emailVerified: true,
  });
  userId = user.id;
  token = signAccessToken({ sub: user.id, role: "user" });
});

afterEach(() => {
  // fresh wardrobe per test for deterministic counts
  registerDemoWardrobeRepository(new InMemoryWardrobeRepository());
});

function auth(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function seedItem(payload: Record<string, unknown>): Promise<WardrobeItem> {
  const res = await request(app)
    .post("/api/v1/wardrobe")
    .set(auth())
    .send(payload);
  expect(res.status).toBe(201);
  return res.body.data.item as WardrobeItem;
}

describe("POST /api/v1/wardrobe", () => {
  it("creates an item for the authenticated user", async () => {
    const res = await request(app)
      .post("/api/v1/wardrobe")
      .set(auth())
      .send({
        name: "Blue Denim Jacket",
        category: "outerwear",
        color: "Blue",
        brand: "Levis",
        purchasedPrice: 60,
        tags: ["denim"],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.item.id).toBeTruthy();
    expect(res.body.data.item.userId).toBe(userId);
    expect(res.body.data.item.timesWorn).toBe(0);
    expect(res.body.data.item.costPerWear).toBeNull();
  });

  it("rejects invalid payloads", async () => {
    const res = await request(app)
      .post("/api/v1/wardrobe")
      .set(auth())
      .send({ name: "", category: "not-a-category", color: "" });
    expect(res.status).toBe(422);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/v1/wardrobe").send({
      name: "Shirt",
      category: "tops",
      color: "White",
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/wardrobe", () => {
  it("searches and sorts items", async () => {
    await seedItem({ name: "White Shirt", category: "tops", color: "White", purchasedPrice: 10 });
    await seedItem({ name: "Black Shoes", category: "footwear", color: "Black", purchasedPrice: 90 });
    await seedItem({ name: "Blue Shirt", category: "tops", color: "Blue", purchasedPrice: 30, tags: ["casual"] });

    const res = await request(app)
      .get("/api/v1/wardrobe?search=shirt&sort=price")
      .set(auth());
    expect(res.status).toBe(200);
    const items = res.body.data.items as WardrobeItem[];
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe("Blue Shirt"); // higher price first
    expect(items[1].name).toBe("White Shirt");
  });

  it("filters by category", async () => {
    await seedItem({ name: "Hat", category: "accessories", color: "Red" });
    await seedItem({ name: "Boots", category: "footwear", color: "Brown" });

    const res = await request(app)
      .get("/api/v1/wardrobe?category=footwear")
      .set(auth());
    const items = res.body.data.items as WardrobeItem[];
    expect(items.map((i) => i.name)).toEqual(["Boots"]);
  });

  it("rejects an unknown sort option", async () => {
    const res = await request(app)
      .get("/api/v1/wardrobe?sort=bogus")
      .set(auth());
    expect(res.status).toBe(422);
  });
});

describe("POST /api/v1/wardrobe/:id/wear", () => {
  it("increments wear count and cost-per-wear only once per day", async () => {
    const item = await seedItem({ name: "Jeans", category: "bottoms", color: "Indigo", purchasedPrice: 50 });

    const first = await request(app)
      .post(`/api/v1/wardrobe/${item.id}/wear`)
      .set(auth());
    expect(first.status).toBe(200);
    expect(first.body.data.item.timesWorn).toBe(1);
    expect(first.body.data.item.costPerWear).toBe(50);

    const second = await request(app)
      .post(`/api/v1/wardrobe/${item.id}/wear`)
      .set(auth());
    expect(second.status).toBe(200);
    expect(second.body.data.item.timesWorn).toBe(1); // no double count same day
  });

  it("does not let another user wear your item", async () => {
    const other = await userRepository.create({ name: "Other", email: "other@example.com" });
    const otherToken = signAccessToken({ sub: other.id, role: "user" });
    const item = await seedItem({ name: "Shirt", category: "tops", color: "White" });

    const res = await request(app)
      .post(`/api/v1/wardrobe/${item.id}/wear`)
      .set({ Authorization: `Bearer ${otherToken}` });
    expect(res.status).toBe(404);
  });
});

describe("Wardrobe image lifecycle", () => {
  it("returns 415 for a disallowed file type", async () => {
    const res = await request(app)
      .post("/api/v1/wardrobe/upload")
      .set(auth())
      .attach("image", Buffer.from("<svg/>"), {
        filename: "x.svg",
        contentType: "image/svg+xml",
      });
    expect(res.status).toBe(415);
  });

  it("returns a signed token for a valid image and saves via token", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const upload = await request(app)
      .post("/api/v1/wardrobe/upload")
      .set(auth())
      .attach("image", png, { filename: "shirt.png", contentType: "image/png" });
    expect(upload.status).toBe(201);
    expect(upload.body.data.imageUrl).toMatch(/^https?:\/\/.*\/uploads\//);
    expect(upload.body.data.imageUploadToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const createRes = await request(app)
      .post("/api/v1/wardrobe")
      .set(auth())
      .send({
        name: "Photographed Shirt",
        category: "tops",
        color: "White",
        imageUploadToken: upload.body.data.imageUploadToken,
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.item.imageUrl).toBe(upload.body.data.imageUrl);
  });

  it("rejects a forged token claim", async () => {
    const forged = "Zm9yZ2VkLXB1YmxpYy1pZAAAAAAAAA.Ggbcfff87394ad8d82b1f49eeee";
    const res = await request(app)
      .post("/api/v1/wardrobe")
      .set(auth())
      .send({
        name: "Try to steal",
        category: "tops",
        color: "Black",
        imageUploadToken: forged,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_IMAGE_TOKEN");
  });
});