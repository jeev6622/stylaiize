import { afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { registerDemoWardrobeRepository } from "@/infrastructure/repos/wardrobe.repo";
import { InMemoryWardrobeRepository } from "@/infrastructure/repos/memory/wardrobe.memory.repo";
import { registerDemoSavedOutfitRepository } from "@/infrastructure/repos/saved-outfit.repo";
import { InMemorySavedOutfitRepository } from "@/infrastructure/repos/memory/saved-outfit.memory.repo";
import { registerDemoFashionMemoryRepository } from "@/infrastructure/repos/fashion-memory.repo";
import { InMemoryFashionMemoryRepository } from "@/infrastructure/repos/memory/fashion-memory.memory.repo";
import { signAccessToken } from "@/utils/jwt";
import type { SavedOutfit } from "@stylaiize/shared";

const app = createApp();

let userRepository: InMemoryUserRepository;
let token: string;
let otherToken: string;

beforeAll(async () => {
  userRepository = new InMemoryUserRepository();
  registerDemoUserRepository(userRepository);
  registerDemoWardrobeRepository(new InMemoryWardrobeRepository());
  registerDemoSavedOutfitRepository(new InMemorySavedOutfitRepository());
  registerDemoFashionMemoryRepository(new InMemoryFashionMemoryRepository());

  const user = await userRepository.create({
    name: "Tester",
    email: "outfits@example.com",
    emailVerified: true,
  });
  token = signAccessToken({ sub: user.id, role: "user" });

  const other = await userRepository.create({
    name: "Other",
    email: "other@example.com",
    emailVerified: true,
  });
  otherToken = signAccessToken({ sub: other.id, role: "user" });
});

afterEach(() => {
  // fresh collections per test for deterministic counts
  registerDemoSavedOutfitRepository(new InMemorySavedOutfitRepository());
  registerDemoWardrobeRepository(new InMemoryWardrobeRepository());
});

function auth(t: string = token): Record<string, string> {
  return { Authorization: `Bearer ${t}` };
}

async function seedOutfit(): Promise<SavedOutfit> {
  const res = await request(app)
    .post("/api/v1/outfits")
    .set(auth())
    .send({
      name: "Weekend brunch",
      category: "smart_casual",
      occasion: "Brunch with friends",
      style: "Minimal",
      items: [
        {
          type: "shirt",
          name: "Linen Shirt",
          brand: "Uniqlo",
          color: "White",
          price: 1200,
          currency: "INR",
        },
      ],
    });
  expect(res.status).toBe(201);
  return res.body.data.outfit as SavedOutfit;
}

describe("POST /api/v1/outfits", () => {
  it("creates a saved outfit for the authenticated user", async () => {
    const res = await request(app)
      .post("/api/v1/outfits")
      .set(auth())
      .send({
        name: "Boardroom ready",
        category: "business",
        items: [
          {
            type: "trousers",
            name: "Charcoal Trousers",
            color: "Grey",
            currency: "INR",
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.outfit.id).toBeTruthy();
    expect(res.body.data.outfit.name).toBe("Boardroom ready");
    expect(res.body.data.outfit.audience).toBe("all");
    expect(res.body.data.outfit.source).toBe("manual");
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/v1/outfits")
      .send({
        name: "Look",
        items: [{ type: "shirt", name: "Shirt", color: "White", currency: "INR" }],
      });
    expect(res.status).toBe(401);
  });

  it("rejects invalid payloads", async () => {
    const res = await request(app)
      .post("/api/v1/outfits")
      .set(auth())
      .send({ name: "", items: [] });
    expect(res.status).toBe(422);
  });

  it("accepts the Build Your Look payload shape", async () => {
    // Regression: the Build Your Look page used to send `source:
    // "build_your_look"` plus item types taken from the coarse build-look slots
    // (upperwear/lowerwear/footwear/accessories), neither of which validated,
    // so every save from that page returned 422.
    const res = await request(app)
      .post("/api/v1/outfits")
      .set(auth())
      .send({
        name: "Build Your Look — Classic · Wedding",
        category: "smart_casual",
        audience: "men",
        occasion: "Wedding",
        style: "Classic",
        colors: ["#ffffff"],
        budget: 5000,
        items: [
          { type: "top", name: "Oxford Shirt", brand: null, color: "#ffffff", price: 1500, currency: "INR", buyUrl: null, imageUrl: null, reason: "Crisp base layer" },
          { type: "trousers", name: "Chinos", brand: null, color: "#1d4ed8", price: 1800, currency: "INR", buyUrl: null, imageUrl: null, reason: "Smart casual" },
          { type: "shoes", name: "Derbies", brand: null, color: "#7c4a1e", price: 2200, currency: "INR", buyUrl: null, imageUrl: null, reason: "Polished finish" },
          { type: "accessory", name: "Leather Belt", brand: null, color: "#3f2a1d", price: 900, currency: "INR", buyUrl: null, imageUrl: null, reason: "Ties the look" },
        ],
        scores: { fashion: 90, eventMatch: 88, comfort: 0, budget: 0 },
        totalCost: 6400,
        explanation: "AI-curated classic look for Wedding.",
        imageUrl: null,
        source: "build_your_look",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.outfit.audience).toBe("men");
    expect(res.body.data.outfit.source).toBe("build_your_look");
    expect(res.body.data.outfit.items.map((i: { type: string }) => i.type)).toEqual([
      "top",
      "trousers",
      "shoes",
      "accessory",
    ]);
  });

  it("round-trips a grooming plan and defaults old outfits to null", async () => {
    const grooming = {
      summary: "Polished finishing touches for brunch.",
      items: [
        { category: "hair", title: "Neat side part", why: "Clean finish", tip: "Use matte cream.", estimatedPriceInr: 400 },
        { category: "facial", title: "Tidy stubble", why: "Defined jawline", tip: "Trim evenly.", estimatedPriceInr: 300 },
        { category: "skin", title: "Mattifying prep", why: "Photo-ready", tip: "Pat on the T-zone.", estimatedPriceInr: 500 },
        { category: "accessory", title: "Leather watch", why: "Polished detail", tip: "Keep it minimal.", estimatedPriceInr: 1500 },
      ],
    };

    const created = await request(app)
      .post("/api/v1/outfits")
      .set(auth())
      .send({
        name: "Brunch with grooming",
        category: "smart_casual",
        items: [
          { type: "shirt", name: "Linen Shirt", color: "White", currency: "INR" },
        ],
        grooming,
      });
    expect(created.status).toBe(201);
    expect(created.body.data.outfit.grooming).toEqual(grooming);

    const fetched = await request(app)
      .get(`/api/v1/outfits/${created.body.data.outfit.id}`)
      .set(auth());
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.outfit.grooming).toEqual(grooming);

    const plain = await seedOutfit();
    expect(plain.grooming).toBeNull();
  });

  it("still rejects item types outside the shared vocabulary", async () => {
    const res = await request(app)
      .post("/api/v1/outfits")
      .set(auth())
      .send({
        name: "Bad slot",
        items: [
          { type: "upperwear", name: "Shirt", color: "White", currency: "INR" },
        ],
      });
    expect(res.status).toBe(422);
  });
});

describe("PATCH /api/v1/outfits/:id", () => {
  it("renames a saved outfit", async () => {
    const outfit = await seedOutfit();
    const res = await request(app)
      .patch(`/api/v1/outfits/${outfit.id}`)
      .set(auth())
      .send({ name: "Renamed look" });
    expect(res.status).toBe(200);
    expect(res.body.data.outfit.name).toBe("Renamed look");
  });

  it("prevents renaming another user's outfit", async () => {
    const outfit = await seedOutfit();
    const res = await request(app)
      .patch(`/api/v1/outfits/${outfit.id}`)
      .set(auth(otherToken))
      .send({ name: "Hacked" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/outfits/:id/regenerate", () => {
  it("returns 404 for an unknown outfit", async () => {
    const res = await request(app)
      .post("/api/v1/outfits/00000000-0000-0000-0000-000000000000/regenerate")
      .set(auth());
    expect(res.status).toBe(404);
  });

  it("does not regenerate another user's outfit", async () => {
    const outfit = await seedOutfit(); // owned by `token` user
    const res = await request(app)
      .post(`/api/v1/outfits/${outfit.id}/regenerate`)
      .set(auth(otherToken));
    expect(res.status).toBe(404);
  });

  it("surfaces AI_NOT_CONFIGURED instead of fabricating a look when no AI is available", async () => {
    const outfit = await seedOutfit();
    const res = await request(app)
      .post(`/api/v1/outfits/${outfit.id}/regenerate`)
      .set(auth());
    // In this environment no real AI key is configured, so the endpoint must
    // honestly report that instead of returning a made-up outfit.
    expect(res.status).toBe(503);
    expect(res.body.error?.code).toBe("AI_NOT_CONFIGURED");
  });
});