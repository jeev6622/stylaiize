import { describe, expect, it } from "vitest";
import type { Product } from "@stylaiize/shared";
import { buildProductComparison, compareProductList } from "./price-comparison.service";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-1",
    title: "Slim Fit Spread Collar Shirt",
    brand: "Allen Solly",
    imageUrl: "https://example.com/shirt.jpg",
    price: 1499,
    originalPrice: null,
    currency: "INR",
    discountPercent: null,
    rating: 4.2,
    reviewCount: null,
    store: "Livostyle",
    deliveryEstimateDays: { min: 3, max: 5 },
    buyUrl: "https://example.com/shirt-1",
    category: "tops",
    colors: ["White"],
    sizes: ["M"],
    inStock: true,
    priceVerifiedAt: "2026-11-19T05:00:00.000Z",
    ...overrides,
  };
}

describe("price comparison", () => {
  it("identifies the cheapest verified exact match", () => {
    const target = product();
    const cheaper = product({
      id: "p-2",
      store: "Other Store",
      buyUrl: "https://other.example/shirt",
      price: 999,
      rating: 4.6,
    });
    const comparison = buildProductComparison(target, [cheaper]);

    expect(comparison.exactMatches).toHaveLength(1);
    expect(comparison.exactMatches[0]?.isLowestPrice).toBe(true);
    expect(comparison.lowestPriceInr).toBe(999);
    expect(comparison.highestPriceInr).toBe(1499);
    expect(comparison.priceDifferenceInr).toBe(500);
  });

  it("keeps similar alternatives separate from exact matches", () => {
    const target = product();
    const similar = product({
      id: "p-3",
      title: "Slim Fit Cotton Shirt",
      brand: "Arrow",
      buyUrl: "https://example.com/shirt-3",
    });
    const comparison = buildProductComparison(target, [similar]);
    expect(comparison.exactMatches).toHaveLength(0);
    expect(comparison.similarAlternatives.length).toBeGreaterThan(0);
    expect(comparison.note).toContain("Similar alternatives are not the same item");
  });

  it("never compares different currencies", () => {
    const target = product();
    const usd = product({
      id: "p-4",
      currency: "USD",
      price: 20,
      buyUrl: "https://example.com/shirt-usd",
    });
    const comparison = buildProductComparison(target, [usd]);
    expect(comparison.exactMatches).toHaveLength(0);
    expect(comparison.similarAlternatives).toHaveLength(0);
  });

  it("returns entries including the target for explicit comparisons", () => {
    const target = product();
    const other = product({
      id: "p-5",
      buyUrl: "https://other.example/shirt",
      price: 1099,
    });
    const comparison = compareProductList([target, other]);
    expect(comparison.entries).toHaveLength(2);
    expect(comparison.entries.find((entry) => entry.isLowestPrice)?.product.id).toBe("p-5");
  });
});
