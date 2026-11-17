import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { signAccessToken } from "@/utils/jwt";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { resetAIProvider } from "@/infrastructure/ai/factory";
import { MAX_IMAGE_UPLOAD_BYTES } from "@/api/middleware/upload.middleware";
import * as storageService from "@/application/services/storage.service";
import {
  FACE_SHAPES,
  HAIR_LENGTHS,
  HAIR_TYPES,
  SKIN_UNDERTONES,
} from "@stylaiize/shared";

const app = createApp();

let token: string;

const originalProvider = env.AI_PROVIDER;
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

beforeAll(async () => {
  const users = new InMemoryUserRepository();
  registerDemoUserRepository(users);
  const user = await users.create({
    name: "Style Profile Tester",
    email: "style-profile@example.com",
    emailVerified: true,
  });
  token = signAccessToken({ sub: user.id, role: "user" });
});

afterAll(() => {
  env.AI_PROVIDER = originalProvider;
  resetAIProvider();
});

function auth(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe("POST /api/v1/style-profile/analyze", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/v1/style-profile/analyze")
      .attach("image", JPEG_BYTES, {
        filename: "me.jpg",
        contentType: "image/jpeg",
      });
    expect(res.status).toBe(401);
  });

  it("rejects unsupported image types with 415", async () => {
    env.AI_PROVIDER = "mock";
    resetAIProvider();

    const res = await request(app)
      .post("/api/v1/style-profile/analyze")
      .set(auth())
      .attach("image", Buffer.from("not an image"), {
        filename: "me.gif",
        contentType: "image/gif",
      });

    expect(res.status).toBe(415);
    expect(res.body.error?.code).toBe("UNSUPPORTED_IMAGE_TYPE");
  });

  it("rejects files above the size cap with 413", async () => {
    const res = await request(app)
      .post("/api/v1/style-profile/analyze")
      .set(auth())
      .attach("image", Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES + 1024), {
        filename: "huge.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(413);
    expect(res.body.error?.code).toBe("FILE_TOO_LARGE");
  });

  it("returns AI_NOT_CONFIGURED instead of inventing a profile", async () => {
    env.AI_PROVIDER = "";
    resetAIProvider();

    const res = await request(app)
      .post("/api/v1/style-profile/analyze")
      .set(auth())
      .attach("image", JPEG_BYTES, {
        filename: "me.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(503);
    expect(res.body.error?.code).toBe("AI_NOT_CONFIGURED");
  });

  it("analyses in memory, returns validated values, and never calls storage", async () => {
    env.AI_PROVIDER = "mock";
    resetAIProvider();
    const saveImage = vi.spyOn(storageService, "saveImage");

    try {
      const res = await request(app)
        .post("/api/v1/style-profile/analyze")
        .set(auth())
        .attach("image", JPEG_BYTES, {
          filename: "me.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(200);
      const profile = res.body.data.styleProfile;
      expect(FACE_SHAPES).toContain(profile.faceShape);
      expect(HAIR_TYPES).toContain(profile.hairType);
      expect(HAIR_LENGTHS).toContain(profile.hairLength);
      expect(SKIN_UNDERTONES).toContain(profile.undertone);
      expect(profile.userEdited).toBe(false);
      expect(profile.confidence).toBeGreaterThanOrEqual(0);
      expect(profile.confidence).toBeLessThanOrEqual(1);
      expect(saveImage).not.toHaveBeenCalled();
    } finally {
      saveImage.mockRestore();
      env.AI_PROVIDER = "";
      resetAIProvider();
    }
  });
});
