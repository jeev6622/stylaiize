import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { CollageOutfitImageProvider } from "./collage-outfit-image.provider";
import { HttpOutfitImageProvider } from "./http-outfit-image.provider";
import { resolveOutfitImageProvider, resetOutfitImageProvider } from "./factory";

const original = {
  enabled: env.OUTFIT_IMAGE_ENABLED,
  mode: env.OUTFIT_IMAGE_PROVIDER,
  url: env.OUTFIT_IMAGE_API_URL,
  key: env.OUTFIT_IMAGE_API_KEY,
  license: env.OUTFIT_IMAGE_LICENSE,
};

afterEach(() => {
  env.OUTFIT_IMAGE_ENABLED = original.enabled;
  env.OUTFIT_IMAGE_PROVIDER = original.mode;
  env.OUTFIT_IMAGE_API_URL = original.url;
  env.OUTFIT_IMAGE_API_KEY = original.key;
  env.OUTFIT_IMAGE_LICENSE = original.license;
  resetOutfitImageProvider();
});

describe("outfit image provider factory", () => {
  it("uses the free local collage provider by default", () => {
    expect(resolveOutfitImageProvider()).toBeInstanceOf(CollageOutfitImageProvider);
  });

  it("uses the optional HTTP provider only when explicitly selected and fully configured", () => {
    env.OUTFIT_IMAGE_PROVIDER = "http";
    expect(resolveOutfitImageProvider()).toBeInstanceOf(CollageOutfitImageProvider);

    resetOutfitImageProvider();
    env.OUTFIT_IMAGE_ENABLED = true;
    env.OUTFIT_IMAGE_API_URL = "https://image.example/render";
    env.OUTFIT_IMAGE_API_KEY = "server-key";
    env.OUTFIT_IMAGE_LICENSE = "commercial licence A-123";
    expect(resolveOutfitImageProvider()).toBeInstanceOf(HttpOutfitImageProvider);
  });
});
