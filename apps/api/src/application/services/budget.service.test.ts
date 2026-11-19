import { describe, expect, it } from "vitest";
import type { Product } from "@stylaiize/shared";
import { calculateBuildLookBudget } from "./budget.service";

function product(id: string, price: number, currency = "INR"): Product {
  return {
    id,
    title: `Product ${id}`,
    brand: null,
    imageUrl: null,
    price,
    originalPrice: null,
    currency,
    discountPercent: null,
    rating: null,
    reviewCount: null,
    store: "Livostyle",
    deliveryEstimateDays: null,
    buyUrl: `https://example.com/${id}`,
    category: "tops",
    colors: [],
    sizes: [],
    inStock: true,
    priceVerifiedAt: "2026-11-19T05:00:00.000Z",
  };
}

describe("build-look budget", () => {
  it("calculates verified INR total and remaining budget", () => {
    const summary = calculateBuildLookBudget("5000", [
      { itemId: "a", product: product("a", 1200), alternatives: [] },
      { itemId: "b", product: product("b", 1800), alternatives: [] },
    ]);
    expect(summary.selectedTotalInr).toBe(3000);
    expect(summary.remainingInr).toBe(2000);
    expect(summary.complete).toBe(true);
  });

  it("hides totals when an item has no product", () => {
    const summary = calculateBuildLookBudget("5000", [
      { itemId: "a", product: product("a", 1200), alternatives: [] },
      { itemId: "b", product: null, alternatives: [] },
    ]);
    expect(summary.selectedTotalInr).toBeNull();
    expect(summary.complete).toBe(false);
    expect(summary.note).toContain("hidden");
  });

  it("hides totals when currencies differ", () => {
    const summary = calculateBuildLookBudget("5000", [
      { itemId: "a", product: product("a", 1200), alternatives: [] },
      { itemId: "b", product: product("b", 20, "USD"), alternatives: [] },
    ]);
    expect(summary.selectedTotalInr).toBeNull();
  });

  it("finds the cheapest complete outfit from verified alternatives", () => {
    const summary = calculateBuildLookBudget("5000", [
      {
        itemId: "a",
        product: product("a", 1800),
        alternatives: [product("a-alt", 900)],
      },
      {
        itemId: "b",
        product: product("b", 2200),
        alternatives: [product("b-alt", 1100)],
      },
    ]);
    expect(summary.cheapestCompleteOutfitInr).toBe(2000);
    expect(summary.cheapestProductIdsByItem).toEqual({ a: "a-alt", b: "b-alt" });
  });

  it("marks premium budgets as uncapped", () => {
    const summary = calculateBuildLookBudget("premium", [
      { itemId: "a", product: product("a", 12000), alternatives: [] },
    ]);
    expect(summary.capInr).toBeNull();
    expect(summary.remainingInr).toBeNull();
  });
});
