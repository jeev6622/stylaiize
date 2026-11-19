import { describe, expect, it } from "vitest";
import type { Product } from "@stylaiize/shared";
import { validateAvailability } from "./availability.service";
import type { ShoppingSearchResult } from "@/infrastructure/shopping/shopping.interface";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-1",
    title: "White Sneakers",
    brand: "Move",
    imageUrl: null,
    price: 1999,
    originalPrice: null,
    currency: "INR",
    discountPercent: null,
    rating: null,
    reviewCount: null,
    store: "Livostyle",
    deliveryEstimateDays: null,
    buyUrl: "https://example.com/sneakers",
    category: "footwear",
    audience: "all",
    styleTags: ["casual"],
    colors: ["White"],
    sizes: ["8"],
    inStock: true,
    ...overrides,
  };
}

const result: ShoppingSearchResult = {
  products: [],
  total: 0,
  page: 1,
  totalPages: 0,
  source: "api",
  checkedAt: "2026-11-19T05:00:00.000Z",
  pinCodeSupported: false,
};

describe("availability validation", () => {
  it("returns null when no PIN code is supplied", () => {
    expect(validateAvailability(product(), null, result)).toBeNull();
  });

  it("states that PIN availability must be confirmed when unsupported", () => {
    const availability = validateAvailability(product(), "560001", result);
    expect(availability?.supported).toBe(false);
    expect(availability?.message).toBe(
      "Please confirm delivery availability on the retailer's website.",
    );
  });

  it("does not claim availability when the provider has no PIN-specific data", () => {
    const availability = validateAvailability(product(), "560001", {
      ...result,
      pinCodeSupported: true,
    });
    expect(availability?.supported).toBe(false);
    expect(availability?.available).toBeNull();
    expect(availability?.message).toBe(
      "Please confirm delivery availability on the retailer's website.",
    );
  });

  it("keeps provider-reported details without inventing delivery data", () => {
    const reported = {
      supported: true,
      pinCode: "560001",
      available: true,
      deliveryEstimateDays: { min: 2, max: 4 },
      deliveryChargesInr: 49,
      message: "Deliverable",
      checkedAt: "2026-11-19T05:00:00.000Z",
    };
    expect(validateAvailability(product({ pinCodeAvailability: reported }), "560001", result)).toEqual(
      reported,
    );
  });
});
