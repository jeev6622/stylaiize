import { afterEach, describe, expect, it, vi } from "vitest";
import { aiService } from "@/application/services/ai.service";
import { analyzeStyleProfile } from "@/application/services/style-profile.service";
import { AIProviderError } from "@/infrastructure/ai/errors";
import type { StyleProfile } from "@stylaiize/shared";

const image = { buffer: Buffer.from("photo"), mimeType: "image/png" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("analyzeStyleProfile", () => {
  it("rejects values outside the shared vocabulary", async () => {
    vi.spyOn(aiService, "generateJson").mockResolvedValue({
      faceShape: "banana",
      hairType: "wavy",
      hairLength: "short",
      undertone: "warm",
      bodyBuild: "average",
      paletteSuggestions: ["olive"],
      confidence: 0.7,
    });

    await expect(analyzeStyleProfile(image)).rejects.toBeInstanceOf(
      AIProviderError,
    );
  });

  it("clamps confidence and ignores unsupported extra fields", async () => {
    vi.spyOn(aiService, "generateJson").mockResolvedValue({
      faceShape: "oval",
      hairType: "straight",
      hairLength: "short",
      undertone: "neutral",
      bodyBuild: "slim",
      paletteSuggestions: ["navy"],
      confidence: 4.2,
      userEdited: true,
      age: 30,
      gender: "unknown",
    });

    const profile = (await analyzeStyleProfile(image)) as StyleProfile & {
      age?: number;
    };

    expect(profile.confidence).toBe(1);
    expect(profile.userEdited).toBe(false);
    expect(profile.age).toBeUndefined();
  });
});
