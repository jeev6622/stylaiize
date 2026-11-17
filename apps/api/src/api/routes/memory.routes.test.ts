import { afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { signAccessToken } from "@/utils/jwt";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { registerDemoFashionMemoryRepository } from "@/infrastructure/repos/fashion-memory.repo";
import { InMemoryFashionMemoryRepository } from "@/infrastructure/repos/memory/fashion-memory.memory.repo";

const app = createApp();

let token: string;

const profile = {
  faceShape: "oval",
  hairType: "wavy",
  hairLength: "short",
  undertone: "warm",
  bodyBuild: "average",
  paletteSuggestions: ["olive", "camel"],
  confidence: 0.6,
  userEdited: true,
};

beforeAll(async () => {
  registerDemoFashionMemoryRepository(new InMemoryFashionMemoryRepository());
  const users = new InMemoryUserRepository();
  registerDemoUserRepository(users);
  const user = await users.create({
    name: "Memory Tester",
    email: "memory@example.com",
    emailVerified: true,
  });
  token = signAccessToken({ sub: user.id, role: "user" });
});

afterEach(() => {
  registerDemoFashionMemoryRepository(new InMemoryFashionMemoryRepository());
});

function auth(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe("fashion memory style profile", () => {
  it("starts with no style profile", async () => {
    const res = await request(app).get("/api/v1/memory").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.memory.styleProfile).toBeNull();
  });

  it("saves only an explicitly reviewed profile", async () => {
    const res = await request(app)
      .put("/api/v1/memory/style-profile")
      .set(auth())
      .send({ styleProfile: profile });

    expect(res.status).toBe(200);
    expect(res.body.data.memory.styleProfile).toEqual(profile);

    const fetched = await request(app).get("/api/v1/memory").set(auth());
    expect(fetched.body.data.memory.styleProfile).toEqual(profile);
  });

  it("rejects a profile that the user has not reviewed", async () => {
    const res = await request(app)
      .put("/api/v1/memory/style-profile")
      .set(auth())
      .send({ styleProfile: { ...profile, userEdited: false } });

    expect(res.status).toBe(422);
    expect(res.body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("does not persist a style profile through the general PATCH endpoint", async () => {
    const res = await request(app)
      .patch("/api/v1/memory")
      .set(auth())
      .send({ styleProfile: profile, favoriteColors: ["navy"] });

    expect(res.status).toBe(200);
    expect(res.body.data.memory.favoriteColors).toEqual(["navy"]);
    expect(res.body.data.memory.styleProfile).toBeNull();
  });
});
