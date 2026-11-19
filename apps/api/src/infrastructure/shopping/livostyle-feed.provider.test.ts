import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetUsdToInrRateCache } from "./currency";
import {
  LivostyleFeedProvider,
  resetLivostyleFeedCache,
} from "./livostyle-feed.provider";

const feedProduct = {
  id: 123,
  handle: "floral-tiered-midi-dress",
  title: "Floral Tiered Midi Dress",
  url: "https://livostyle.com/products/floral-tiered-midi-dress",
  product_type: "Midi Dress",
  vendor: "Livostyle",
  description: "A breezy tiered midi dress in soft cotton.",
  category: { name: "Dresses", full_path: "Apparel & Accessories > Clothing > Dresses" },
  price: { min_usd: 40, max_usd: 48, currency: "USD" },
  images: [{ url: "https://cdn.shopify.com/image.jpg" }],
  featured_image_url: "https://cdn.shopify.com/image.jpg",
  variants: [
    {
      sku: "FLDR-S",
      title: "Small",
      price_usd: 40,
      compare_at_price_usd: 55,
      in_stock: true,
      options: { Size: "S", Color: "Pink Floral" },
    },
  ],
  reviews: { rating: 4.8, count: 12 },
  tags: ["boho", "floral", "summer"],
};

function mockResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  resetLivostyleFeedCache();
  resetUsdToInrRateCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("frankfurter.app")) {
        return mockResponse({
          amount: 1,
          base: "USD",
          date: "2026-11-18",
          rates: { INR: 93.44 },
        });
      }
      if (url.includes("products.json")) return mockResponse([feedProduct]);
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetLivostyleFeedCache();
  resetUsdToInrRateCache();
});

describe("LivostyleFeedProvider", () => {
  it("maps real feed products into verified INR listings", async () => {
    const provider = new LivostyleFeedProvider();
    const result = await provider.search({
      query: "floral dress",
      category: "dresses",
      maxPrice: 5000,
      limit: 12,
    });

    expect(result.source).toBe("api");
    expect(result.total).toBe(1);
    expect(result.fx).toEqual({ base: "USD", quote: "INR", rate: 93.44, date: "2026-11-18" });
    const product = result.products[0];
    expect(product.id).toBe("livostyle-floral-tiered-midi-dress");
    expect(product.title).toBe("Floral Tiered Midi Dress");
    expect(product.price).toBe(3738);
    expect(product.currency).toBe("INR");
    expect(product.sourcePrice).toEqual({ amount: 40, currency: "USD" });
    expect(product.buyUrl).toBe(feedProduct.url);
    expect(product.sizes).toContain("S");
    expect(product.colors).toContain("Pink Floral");
    expect(product.store).toBe("Livostyle");
    expect(product.audience).toBe("women");
    expect(product.styleTags).toContain("western");
  });

  it("never returns women's feed products for men's requests", async () => {
    const provider = new LivostyleFeedProvider();
    const result = await provider.search({ query: "floral dress", audience: "men" });
    expect(result.total).toBe(0);
  });

  it("filters by explicit style tags", async () => {
    const provider = new LivostyleFeedProvider();
    const result = await provider.search({
      query: "floral dress",
      style: "traditional",
    });
    expect(result.total).toBe(0);
  });

  it("applies the INR budget filter to converted prices", async () => {
    const provider = new LivostyleFeedProvider();
    const result = await provider.search({ query: "floral dress", maxPrice: 1000 });
    expect(result.total).toBe(0);
  });

  it("returns null for an unknown product id", async () => {
    const provider = new LivostyleFeedProvider();
    expect(await provider.getById("livostyle-unknown")).toBeNull();
  });
});
