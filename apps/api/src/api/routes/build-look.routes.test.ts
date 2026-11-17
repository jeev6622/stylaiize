import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { signAccessToken } from "@/utils/jwt";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { registerDemoFashionMemoryRepository } from "@/infrastructure/repos/fashion-memory.repo";
import { InMemoryFashionMemoryRepository } from "@/infrastructure/repos/memory/fashion-memory.memory.repo";
import { resetAIProvider } from "@/infrastructure/ai/factory";
import { GROOMING_CATEGORIES } from "@stylaiize/shared";

const app = createApp();

let token: string;
const originalProvider = env.AI_PROVIDER;

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
  resetAIProvider();
});

function auth(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

const brief = {
  eventName: "Priya's engagement",
  occasion: "engagement",
  dressCode: "smart casual",
  style: "modern",
  budget: "10000",
};

describe("POST /api/v1/build-look/generate grooming", () => {
  it("returns a 4-6 item grooming plan in the shared categories", async () => {
    const res = await request(app)
      .post("/api/v1/build-look/generate")
      .set(auth())
      .send(brief);

    expect(res.status).toBe(200);
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
    expect(res.body.data.look.items.length).toBeGreaterThan(0);
    expect("grooming" in res.body.data).toBe(false);
    expect(res.body.data.look.styleProfile).toBeUndefined();
  });
});
