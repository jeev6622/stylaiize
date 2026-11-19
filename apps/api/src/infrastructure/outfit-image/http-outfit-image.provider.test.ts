import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpOutfitImageProvider } from "./http-outfit-image.provider";

const config = {
  id: "http_json",
  endpoint: "https://image.example/render",
  apiKey: "server-side-key",
  license: "commercial licence A-123",
  timeoutMs: 5_000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpOutfitImageProvider", () => {
  it("posts the composed prompt and returns the provider image with the configured licence", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        imageUrl: "https://images.example/render/abc.png",
        provider: "render-v1",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new HttpOutfitImageProvider(config);
    const result = await provider.generate({ prompt: "Render this exact outfit", audience: "women" });

    expect(fetchMock).toHaveBeenCalledWith(
      config.endpoint,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prompt: "Render this exact outfit", audience: "women" }),
      }),
    );
    expect(result).toEqual({
      imageUrl: "https://images.example/render/abc.png",
      provider: "render-v1",
      license: config.license,
    });
  });

  it("rejects a response without a provider name and HTTPS imageUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ imageUrl: "http://images.example/render/abc.png" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new HttpOutfitImageProvider(config);
    await expect(
      provider.generate({ prompt: "Render this exact outfit", audience: "women" }),
    ).rejects.toThrow(/provider name and an HTTPS imageUrl/);
  });

  it("rejects a non-OK provider response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new HttpOutfitImageProvider(config);
    await expect(
      provider.generate({ prompt: "Render this exact outfit", audience: "women" }),
    ).rejects.toThrow(/HTTP 503/);
  });
});
