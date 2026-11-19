import { describe, expect, it, vi } from "vitest";
import type {
  CompleteOutfitImageRequest,
  ShopAudience,
} from "@stylaiize/shared";
import {
  buildCompleteOutfitImagePrompt,
  generateCompleteOutfitImage,
} from "./complete-outfit-image.service";
import type {
  OutfitImageGeneration,
  OutfitImageGenerationRequest,
  OutfitImageProviderPort,
} from "@/infrastructure/outfit-image/outfit-image.interface";

const look: CompleteOutfitImageRequest = {
  eventName: "Priya's engagement",
  audience: "women",
  occasion: "engagement ceremony",
  dressCode: "smart casual",
  style: "modern",
  budget: "10000",
  colors: ["navy", "ivory"],
  fit: "tailored",
  fitGuidance: "regular fit with a defined waist",
  colorCombination: "navy and ivory",
  footwear: "ivory block heels",
  accessories: ["pearl studs"],
  items: [
    {
      id: "item-1",
      name: "Ivory silk blouse",
      category: "upperwear",
      color: "ivory",
      material: "silk",
      size: "regular",
      description: "tucked into the skirt",
    },
    {
      id: "item-2",
      name: "Navy midi skirt",
      category: "lowerwear",
      color: "navy",
      description: "tailored A-line shape",
    },
  ],
};

function providerReturning(
  generation: OutfitImageGeneration,
  capture?: (request: OutfitImageGenerationRequest) => void,
): OutfitImageProviderPort {
  return {
    id: "test-provider",
    isConfigured: true,
    supportedAudiences: ["men", "women", "unisex"],
    async generate(request) {
      capture?.(request);
      return generation;
    },
  };
}

describe("complete-outfit image service", () => {
  it("returns an honest error when no verified product images are available", async () => {
    const result = await generateCompleteOutfitImage(look);

    expect(result.status).toBe("error");
    expect(result.needsConfig).toBe(false);
    expect(result.completeOutfitImage).toBeNull();
    expect(result.image).toBeNull();
    expect(result.message).toContain("no valid verified product images");
  });

  it("sets genuine provider fields only on success", async () => {
    const provider = providerReturning({
      imageUrl: "https://images.licensed-provider.example/outfits/abc123.png",
      provider: "licensed-render-v1",
      license: "commercial licence A-123",
    });

    const result = await generateCompleteOutfitImage(look, provider);

    expect(result.status).toBe("success");
    expect(result.needsConfig).toBe(false);
    expect(result.completeOutfitImage).toEqual({
      url: "https://images.licensed-provider.example/outfits/abc123.png",
      provider: "licensed-render-v1",
      license: "commercial licence A-123",
      audience: "women" satisfies ShopAudience,
      generatedAt: expect.any(String),
      matchBasis: "ai_outfit",
    });
    expect(result.image).toEqual({
      url: "https://images.licensed-provider.example/outfits/abc123.png",
      provider: "licensed-render-v1",
      license: "commercial licence A-123",
      audience: "women" satisfies ShopAudience,
      generatedAt: expect.any(String),
      matchBasis: "ai_outfit",
    });
    expect(Number.isNaN(Date.parse(result.image!.generatedAt))).toBe(false);
  });

  it("returns an error state with no image when the provider fails", async () => {
    const provider: OutfitImageProviderPort = {
      id: "failing-provider",
      isConfigured: true,
      generate: vi.fn().mockRejectedValue(new Error("provider down")),
    };

    const result = await generateCompleteOutfitImage(look, provider);

    expect(result.status).toBe("error");
    expect(result.needsConfig).toBe(false);
    expect(result.completeOutfitImage).toBeNull();
    expect(result.image).toBeNull();
    expect(result.message).toContain("no image was generated");
  });

  it("rejects a malformed provider response instead of fabricating an image", async () => {
    const provider = providerReturning({
      imageUrl: "http://insecure.example/outfit.png",
      provider: "licensed-render-v1",
      license: "commercial licence A-123",
    });

    const result = await generateCompleteOutfitImage(look, provider);

    expect(result.status).toBe("error");
    expect(result.completeOutfitImage).toBeNull();
    expect(result.image).toBeNull();
  });

  it("builds the prompt from the actual items, colours, audience, occasion and style", async () => {
    let sent: OutfitImageGenerationRequest | undefined;
    const provider = providerReturning(
      {
        imageUrl: "https://images.licensed-provider.example/outfits/def456.png",
        provider: "licensed-render-v1",
        license: "commercial licence A-123",
      },
      (request) => {
        sent = request;
      },
    );

    await generateCompleteOutfitImage(look, provider);

    expect(sent?.audience).toBe("women");
    const prompt = sent?.prompt ?? "";
    expect(prompt).toContain("Ivory silk blouse");
    expect(prompt).toContain("Navy midi skirt");
    expect(prompt).toContain("colour: ivory");
    expect(prompt).toContain("navy and ivory");
    expect(prompt).toContain("Audience: women");
    expect(prompt).toContain("engagement ceremony");
    expect(prompt).toContain("Style: modern");
    expect(prompt).toContain("Fit guidance: regular fit with a defined waist");
    expect(buildCompleteOutfitImagePrompt(look)).toBe(prompt);
  });
});
