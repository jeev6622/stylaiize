import { describe, expect, it } from "vitest";
import type { BuildLookShopResult, GroomingPlan, Product } from "@stylaiize/shared";
import type { OutfitData, OutfitItem } from "../components/build-look/types";
import { buildOutfitBreakdown, getInspirationImageUrl, getVerifiedProduct } from "./outfit-breakdown";

function item(id: string, name: string, category: string, color: string): OutfitItem {
  return {
    id,
    index: 0,
    name,
    subtitle: `${name} styling reason`,
    description: `${name} short description`,
    price: 0,
    brand: null,
    material: "Wool blend",
    color,
    size: "Slim fit",
    rating: 0,
    store: "",
    imageUrl: null,
    hotspotPosition: [0, 1, 0],
    category,
  };
}

function product(id: string, title: string): Product {
  return {
    id,
    title,
    brand: "Verified Store",
    imageUrl: null,
    price: 4999,
    originalPrice: null,
    currency: "INR",
    discountPercent: null,
    rating: null,
    reviewCount: null,
    store: "Verified Store",
    deliveryEstimateDays: null,
    buyUrl: "https://example.com/product",
    category: "upperwear",
    audience: "men",
    styleTags: [],
    colors: [],
    sizes: [],
    inStock: true,
  };
}

function outfit(items: OutfitItem[]): OutfitData {
  return {
    eventName: "Engagement",
    audience: "men",
    styleName: "Refined Classic",
    styleMatch: 92,
    eventMatch: 95,
    items,
    originalTotal: 0,
    optimizedTotal: 0,
    savings: 0,
    fitGuidance: "Tailored fit throughout",
    shoppingQueries: ["black blazer"],
    recommendedColors: ["black", "ivory"],
  };
}

function shopResult(): BuildLookShopResult {
  return {
    matches: [
      {
        itemId: "blazer",
        itemName: "Black tailored blazer",
        searchQuery: "black tailored blazer men",
        status: "found",
        product: product("p-1", "Black Tailored Blazer"),
        alternatives: [],
        comparison: null,
        availability: null,
      },
    ],
    source: "api",
    sourceLabel: "Live catalog",
    fx: null,
    budget: null,
    pinCode: null,
    providers: {
      active: "real",
      activeProviderId: "livostyle",
      demoMode: false,
      configured: true,
      providers: [],
    },
    checkedAt: "2026-11-19T00:00:00.000Z",
  };
}

const grooming: GroomingPlan = {
  summary: "Keep grooming minimal and polished.",
  items: [
    {
      category: "hair",
      title: "Neat side part",
      why: "Keeps the formal look clean.",
      tip: "Use a matte finish.",
    },
  ],
};

describe("outfit breakdown", () => {
  it("groups every AI item and grooming item into the requested categories", () => {
    const result = buildOutfitBreakdown({
      outfit: outfit([
        item("blazer", "Black tailored blazer", "upperwear", "black"),
        item("trousers", "Black trousers", "lowerwear", "black"),
        item("loafers", "Black loafers", "footwear", "black"),
        item("watch", "Silver watch", "accessories", "silver"),
      ]),
      grooming,
      shopResult: shopResult(),
    });

    expect(result.map((section) => section.id)).toEqual([
      "upperwear",
      "lowerwear",
      "footwear",
      "accessories",
      "grooming",
    ]);
    expect(result[0]?.items[0]).toMatchObject({
      id: "blazer",
      name: "Black tailored blazer",
      category: "upperwear",
      colour: "black",
      fit: "Slim fit",
      description: "Black tailored blazer short description",
      reason: "Black tailored blazer styling reason",
      shoppingQuery: "black tailored blazer men",
    });
    expect(result[1]?.items[0]?.name).toBe("Black trousers");
    expect(result[2]?.items[0]?.name).toBe("Black loafers");
    expect(result[3]?.items[0]?.name).toBe("Silver watch");
    expect(result[4]?.items[0]).toMatchObject({
      name: "Neat side part",
      reason: "Keeps the formal look clean.",
      isGrooming: true,
    });
  });

  it("exposes only verified shopping results", () => {
    const result = buildOutfitBreakdown({
      outfit: outfit([item("blazer", "Black tailored blazer", "upperwear", "black")]),
      grooming: null,
      shopResult: shopResult(),
    });
    const entry = result[0]?.items[0];
    expect(getVerifiedProduct(entry?.shopMatch ?? null)?.title).toBe("Black Tailored Blazer");
    expect(getVerifiedProduct(null)).toBeNull();
  });

  it("does not invent an inspiration image when none is supplied", () => {
    expect(getInspirationImageUrl(outfit([]))).toBeNull();
    expect(getInspirationImageUrl({ ...outfit([]), inspirationImageUrl: "/images/look.jpg" })).toBe(
      "/images/look.jpg",
    );
  });
});
