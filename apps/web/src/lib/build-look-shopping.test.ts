import { describe, expect, it } from "vitest";
import type { BuildYourLookData } from "@stylaiize/shared";
import {
  buildCompleteOutfitImageRequestPayload,
  buildItemShoppingQueries,
  buildLookShopFingerprint,
} from "./build-look-shopping";

const look: BuildYourLookData = {
  eventName: "Friends Wedding",
  audience: "men",
  styleName: "Modern Earthy Formal",
  styleMatch: 92,
  eventMatch: 94,
  shoppingQueries: ["shirt", "trousers"],
  recommendedColors: ["Jet Black", "Tobacco Brown", "Deep Tan", "Cream"],
  fitGuidance: "Relaxed tailoring",
  items: [
    {
      id: "item-1",
      name: "Formal shirt",
      category: "upperwear",
      color: "Cream",
      material: "Cotton",
    },
    {
      id: "item-2",
      name: "Tailored trousers",
      category: "lowerwear",
      color: "Jet Black",
      material: "Wool blend",
    },
  ],
} as BuildYourLookData;

const context = {
  audience: "men" as const,
  occasion: "Friends Wedding",
  style: "modern",
  budget: "5000" as const,
  colors: ["Cream", "Jet Black"],
  fit: "Relaxed tailoring",
};

describe("build-look shopping helpers", () => {
  it("builds one deterministic query per actual outfit item", () => {
    const queries = buildItemShoppingQueries(look, context);
    expect(queries).toHaveLength(look.items.length);
    expect(queries[0]).toContain("men's");
    expect(queries[0]).toContain("cream");
    expect(queries[0]).toContain("formal shirt");
    expect(queries[0]).toContain("friends wedding");
    expect(queries[0]).toContain("modern");
    expect(queries[0]).toContain("under 5000 rupees");
    expect(queries[1]).toContain("jet black");
    expect(queries[1]).toContain("tailored trousers");
  });

  it("builds an image request from the actual look details", () => {
    const payload = buildCompleteOutfitImageRequestPayload(look, context);
    expect(payload.eventName).toBe("Friends Wedding");
    expect(payload.style).toBe("modern");
    expect(payload.audience).toBe("men");
    expect(payload.fitGuidance).toBe("Relaxed tailoring");
    expect(payload.season).toBeUndefined();
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0]).toMatchObject({
      id: "item-1",
      name: "Formal shirt",
      category: "upperwear",
      color: "Cream",
      material: "Cotton",
    });
    expect(payload.colors).toEqual(expect.arrayContaining(["Cream", "Jet Black"]));
  });

  it("changes the fingerprint when the context or items change", () => {
    const first = buildLookShopFingerprint(look, context);
    expect(buildLookShopFingerprint(look, context)).toBe(first);
    expect(buildLookShopFingerprint(look, { ...context, budget: "2000" })).not.toBe(first);
    expect(
      buildLookShopFingerprint(
        { ...look, items: [{ ...look.items[0], color: "Tobacco Brown" }] },
        context,
      ),
    ).not.toBe(first);
  });
});
