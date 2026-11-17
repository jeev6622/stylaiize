import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();

afterAll(async () => {
  // no-op placeholder to keep DB teardown in one place for later phases
});

describe("GET /api/v1/health", () => {
  it("returns ok status with provider info", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.providers.ai).toBeDefined();
    expect(res.body.data.providers.database).toBeDefined();
  });
});

describe("GET /api/v1/auth/config", () => {
  it("returns auth provider availability", async () => {
    const res = await request(app).get("/api/v1/auth/config");
    expect(res.status).toBe(200);
    expect(res.body.data.emailLogin).toBe(true);
    expect(typeof res.body.data.googleLogin).toBe("boolean");
  });
});

describe("404 handling", () => {
  it("returns a structured 404 for unknown routes", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
