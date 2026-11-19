import { describe, expect, it } from "vitest";
import type { Product } from "@stylaiize/shared";
import {
  findExactMatches,
  findSimilarAlternatives,
  isExactProductMatch,
} from "./product-matching.service";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-1",
    title: "Light Blue Oxford Shirt",
    brand: "Studio Fit",
    imageUrl: "https://example.com/shirt.jpg",
    price: 1999,
    originalPrice: null,
    currency: "INR",
    discountPercent: null,
    rating: null,
    reviewCount: null,
    store: "Livostyle",
    deliveryEstimateDays: null,
    buyUrl: "https://example.com/shirt-1",
    category: "tops",
    audience: "women",
    styleTags: ["western", "formal"],
    colors: ["Light Blue"],
    sizes: ["M"],
    inStock: true,
    priceVerifiedAt: "2026-11-19T05:00:00.000Z",
    ...overrides,
  };
}

describe("product matching", () => {
  it("matches the same verified product across retailers", () => {
    const target = product();
    const same = product({
      id: "p-2",
      store: "Other Store",
      buyUrl: "https://other.example/shirt",
      price: 1799,
    });
    expect(isExactProductMatch(target, same)).toBe(true);
    expect(findExactMatches(target, [same])).toHaveLength(1);
  });

  it("does not call different products the same item", () => {
    const target = product();
    const different = product({
      id: "p-3",
      title: "Navy Denim Jacket",
      brand: "North Lane",
      buyUrl: "https://example.com/jacket",
      category: "outerwear",
    });
    expect(isExactProductMatch(target, different)).toBe(false);
    expect(findExactMatches(target, [different])).toHaveLength(0);
  });

  it("does not treat similar titles from different retailers as the same item", () => {
    const target = product();
    const similarTitle = product({
      id: "p-9",
      title: "Light Blue Oxford Shirt Slim Fit",
      store: "Other Store",
      buyUrl: "https://other.example/shirt-slim",
      price: 1899,
    });
    expect(isExactProductMatch(target, similarTitle)).toBe(false);
    expect(findExactMatches(target, [similarTitle])).toHaveLength(0);
  });

  it("returns similar alternatives with a reason", () => {
    const target = product();
    const similar = product({
      id: "p-4",
      title: "Sky Blue Oxford Shirt",
      buyUrl: "https://example.com/shirt-4",
      price: 1899,
    });
    const alternatives = findSimilarAlternatives(target, [similar]);
    expect(alternatives).toHaveLength(1);
    expect(alternatives[0]?.reason).toContain("similar title/style");
  });

  it("supports men's and women's categories without cross-category matching", () => {
    const womensDress = product({
      id: "women-1",
      title: "Floral Midi Dress",
      category: "dresses",
      colors: ["Pink"],
    });
    const mensShirt = product({
      id: "men-1",
      title: "Slim Fit Oxford Shirt",
      category: "tops",
      colors: ["Blue"],
    });
    expect(isExactProductMatch(womensDress, mensShirt)).toBe(false);
    expect(findSimilarAlternatives(womensDress, [mensShirt])).toHaveLength(0);
  });
});
