import { describe, expect, it } from "vitest";
import type { BuildLookShopResult, Product } from "@stylaiize/shared";
import type { OutfitItem } from "@/components/build-look/types";
import {
  buildOutfitPieces,
  buildProductModel3dProxyUrl,
  isExactModel3dUrl,
  isVerifiedOutfitProduct,
  mapCategoryToGarmentSlot,
  productColorToHex,
  resolveGarmentRenderMode,
} from "./outfit-pieces";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    title: "Navy blazer",
    brand: "Example Brand",
    imageUrl: "https://images.example/blazer.webp",
    price: 2499,
    originalPrice: null,
    currency: "INR",
    discountPercent: null,
    rating: null,
    reviewCount: null,
    store: "Example Store",
    deliveryEstimateDays: null,
    buyUrl: "https://shop.example/products/navy-blazer",
    category: "blazer",
    audience: "men",
    styleTags: [],
    colors: ["navy"],
    sizes: ["M"],
    inStock: true,
    priceVerifiedAt: "2026-11-19T05:00:00.000Z",
    matchType: "exact",
    ...overrides,
  };
}

function item(overrides: Partial<OutfitItem> = {}): OutfitItem {
  return {
    id: "item-1",
    index: 0,
    name: "Tailored blazer",
    subtitle: "Structured layer",
    description: "A tailored layer.",
    price: 0,
    brand: null,
    material: "Wool blend",
    color: "navy",
    size: "M",
    rating: 0,
    store: "",
    imageUrl: null,
    hotspotPosition: [0, 1.3, 0.25],
    category: "blazer",
    ...overrides,
  };
}

function shop(matches: BuildLookShopResult["matches"]): BuildLookShopResult {
  return {
    matches,
    source: "api",
    sourceLabel: "Verified products",
    fx: null,
    budget: null,
    pinCode: null,
    providers: {
      active: "real",
      activeProviderId: "verified-fixture",
      demoMode: false,
      configured: true,
      providers: [],
    },
    checkedAt: "2026-11-19T05:00:00.000Z",
  };
}

describe("outfit pieces", () => {
  it("maps generated categories to the supported garment slots", () => {
    expect(mapCategoryToGarmentSlot("blazer")).toBe("outerwear");
    expect(mapCategoryToGarmentSlot("dress shirt")).toBe("top");
    expect(mapCategoryToGarmentSlot("jeans")).toBe("bottom");
    expect(mapCategoryToGarmentSlot("loafers")).toBe("footwear");
    expect(mapCategoryToGarmentSlot("watch")).toBe("accessory");
    expect(mapCategoryToGarmentSlot("unknown")).toBeNull();
  });

  it("rejects products that are not verified for the requested audience", () => {
    expect(isVerifiedOutfitProduct(product(), "men")).toBe(true);
    expect(isVerifiedOutfitProduct(product({ audience: "women" }), "men")).toBe(false);
    expect(isVerifiedOutfitProduct(product({ audience: "unisex" }), "men")).toBe(true);
    expect(isVerifiedOutfitProduct(product({ priceVerifiedAt: null }), "men")).toBe(false);
    expect(isVerifiedOutfitProduct(product({ inStock: false }), "men")).toBe(false);
    expect(isVerifiedOutfitProduct(product({ imageUrl: "http://images.example/a.webp" }), "men")).toBe(
      false,
    );
  });

  it("joins shopping products by item id instead of array index", () => {
    const pieces = buildOutfitPieces(
      [item({ id: "second" }), item({ id: "first", category: "jeans" })],
      shop([
        {
          itemId: "first",
          itemName: "first",
          searchQuery: "shirt",
          status: "found",
          product: product({ id: "jeans-product", title: "Jeans" }),
          alternatives: [],
          comparison: null,
          availability: null,
        },
      ]),
      "men",
    );

    expect(pieces[0]!.product).toBeNull();
    expect(pieces[1]!.product?.id).toBe("jeans-product");
    expect(pieces[1]!.slot).toBe("bottom");
  });

  it("uses exact, template, then 2D fallback order", () => {
    expect(
      resolveGarmentRenderMode(product({ model3dUrl: "https://models.example/a.glb" }), "top", item()),
    ).toBe("exact");
    expect(resolveGarmentRenderMode(product(), "top", item())).toBe("template");
    expect(resolveGarmentRenderMode(product(), null, item())).toBe("2d");
    expect(resolveGarmentRenderMode(null, null, item({ imageUrl: null }))).toBe("template");
  });

  it("builds a safe proxy URL for exact product models", () => {
    expect(isExactModel3dUrl("https://models.example/a.glb")).toBe(true);
    expect(isExactModel3dUrl("http://models.example/a.glb")).toBe(false);
    expect(buildProductModel3dProxyUrl("https://models.example/a.glb")).toContain(
      "model-3d?url=https%3A%2F%2Fmodels.example%2Fa.glb",
    );
  });

  it("derives a usable display colour from the verified product", () => {
    expect(productColorToHex(product({ colors: ["#123456"] }), "")).toBe("#123456");
    expect(productColorToHex(product({ colors: ["navy"] }), "")).toBe("#1e3a8a");
    expect(productColorToHex(null, "red")).toBe("#b91c1c");
    expect(productColorToHex(null, "unmapped")).toBe("#64748b");
  });
});
