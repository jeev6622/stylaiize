import { describe, expect, it } from "vitest";
import {
  normalizeImage,
  parseResultBody,
  toRawBase64,
  toVtonCategory,
} from "./utils";

function dataUrl(mime: string, value: string): string {
  return `data:${mime};base64,${Buffer.from(value).toString("base64")}`;
}

describe("VTON image helpers", () => {
  it("strips the data-URL prefix and reports the MIME type", () => {
    const value = dataUrl("image/png", "fake-image-bytes");
    const image = normalizeImage(value, { label: "Person photo" });

    expect(image.base64).toBe(toRawBase64(value));
    expect(image.mimeType).toBe("image/png");
    expect(image.byteLength).toBeGreaterThan(0);
  });

  it("accepts raw base64 and sniffs the image type", () => {
    const base64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]).toString("base64");
    const image = normalizeImage(base64, { label: "Garment photo" });
    expect(image.mimeType).toBe("image/png");
  });

  it("rejects remote URLs instead of fetching them (SSRF protection)", () => {
    expect(() =>
      normalizeImage("https://example.com/person.jpg", { label: "Person photo" }),
    ).toThrow(/not a remote URL/i);
  });

  it("rejects unsupported image types", () => {
    expect(() =>
      normalizeImage(dataUrl("image/gif", "gif-bytes"), { label: "Person photo" }),
    ).toThrow(/unsupported image type/i);
  });

  it("enforces the decoded size limit", () => {
    expect(() =>
      normalizeImage(dataUrl("image/png", "too-large"), {
        label: "Person photo",
        maxBytes: 2,
      }),
    ).toThrow(/too large/i);
  });
});

describe("VTON category mapping", () => {
  it("maps StylAIze garment types to model categories", () => {
    expect(toVtonCategory("shirt")).toBe("upper_body");
    expect(toVtonCategory("outerwear")).toBe("upper_body");
    expect(toVtonCategory("jeans")).toBe("lower_body");
    expect(toVtonCategory("skirt")).toBe("lower_body");
    expect(toVtonCategory("dress")).toBe("dresses");
    expect(toVtonCategory("shoes")).toBeUndefined();
  });
});

describe("VTON result parsing", () => {
  it("parses raw image responses", () => {
    const body = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const parsed = parseResultBody(body, "image/png");
    expect(parsed.imageData).toBe(body.toString("base64"));
    expect(parsed.mimeType).toBe("image/png");
  });

  it("parses JSON image fields and image URLs", () => {
    const base64 = Buffer.from("generated-image-".repeat(8)).toString("base64");
    expect(parseResultBody(JSON.stringify({ image: base64 }), "application/json").imageData)
      .toBe(base64);
    expect(
      parseResultBody(
        JSON.stringify({ data: { output_url: "https://cdn.example.com/result.png" } }),
        "application/json",
      ).imageUrl,
    ).toBe("https://cdn.example.com/result.png");
  });
});
