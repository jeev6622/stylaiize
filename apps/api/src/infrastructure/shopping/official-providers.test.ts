import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "@/config/env";
import { AmazonCreatorsProvider } from "./amazon-creators.provider";
import { FlipkartAffiliateProvider } from "./flipkart-affiliate.provider";
import { RealShoppingProvider } from "./real-shopping.provider";

const original = {
  amazonId: env.AMAZON_CREATORS_CLIENT_ID,
  amazonSecret: env.AMAZON_CREATORS_CLIENT_SECRET,
  amazonTag: env.AMAZON_CREATORS_PARTNER_TAG,
  flipkartId: env.FLIPKART_AFFILIATE_ID,
  flipkartToken: env.FLIPKART_AFFILIATE_TOKEN,
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  env.AMAZON_CREATORS_CLIENT_ID = original.amazonId;
  env.AMAZON_CREATORS_CLIENT_SECRET = original.amazonSecret;
  env.AMAZON_CREATORS_PARTNER_TAG = original.amazonTag;
  env.FLIPKART_AFFILIATE_ID = original.flipkartId;
  env.FLIPKART_AFFILIATE_TOKEN = original.flipkartToken;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("official shopping provider adapters", () => {
  it("maps Amazon Creators API results with INR prices and audience", async () => {
    env.AMAZON_CREATORS_CLIENT_ID = "client";
    env.AMAZON_CREATORS_CLIENT_SECRET = "secret";
    env.AMAZON_CREATORS_PARTNER_TAG = "stylaize-21";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/auth/o2/token")) {
        return json({ access_token: "token", expires_in: 3600 });
      }
      expect(url).toBe("https://creatorsapi.amazon/catalog/v1/searchItems");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("x-marketplace")).toBe("www.amazon.in");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token");
      return json({
        searchResult: {
          totalResultCount: 1,
          items: [
            {
              asin: "B0TEST1234",
              detailPageURL: "https://www.amazon.in/dp/B0TEST1234?tag=stylaize-21",
              images: { primary: { large: { url: "https://example.com/dress.jpg" } } },
              itemInfo: {
                title: { displayValue: "Women's Formal Dress" },
                byLineInfo: { brand: { displayValue: "Style House" } },
              },
              offersV2: {
                listings: [
                  {
                    availability: { type: "IN_STOCK" },
                    isBuyBoxWinner: true,
                    price: { money: { amount: 2999, currency: "INR" } },
                  },
                ],
              },
            },
          ],
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AmazonCreatorsProvider();
    const result = await provider.search({
      query: "formal dress",
      audience: "women",
      limit: 10,
    });

    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      id: "amazon:B0TEST1234",
      price: 2999,
      currency: "INR",
      audience: "women",
      inStock: true,
    });
    expect(provider.connectionState).toBe("connected");
  });

  it("does not fall back when Amazon credentials are rejected", async () => {
    env.AMAZON_CREATORS_CLIENT_ID = "client";
    env.AMAZON_CREATORS_CLIENT_SECRET = "bad";
    env.AMAZON_CREATORS_PARTNER_TAG = "stylaize-21";
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 403)));

    const provider = new AmazonCreatorsProvider();
    await expect(provider.search({ query: "shirt" })).rejects.toThrow(
      "Amazon Creators authentication failed.",
    );
    expect(provider.connectionState).toBe("authentication_failed");
  });

  it("maps Flipkart Affiliate results without inventing PIN delivery data", async () => {
    env.FLIPKART_AFFILIATE_ID = "stylaize";
    env.FLIPKART_AFFILIATE_TOKEN = "token";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toContain("https://affiliate-api.flipkart.net/affiliate/1.0/search.json");
      const headers = new Headers(init?.headers);
      expect(headers.get("Fk-Affiliate-Id")).toBe("stylaize");
      expect(headers.get("Fk-Affiliate-Token")).toBe("token");
      return json({
        productInfoList: [
          {
            productBaseInfoV1: {
              productId: "FLIPMEN001",
              title: "Men's Formal Shirt",
              imageUrls: { "400x400": "https://example.com/shirt.jpg" },
              flipkartSpecialPrice: { amount: 1299, currency: "INR" },
              maximumRetailPrice: { amount: 2499, currency: "INR" },
              productUrl: "https://www.flipkart.com/product?pid=FLIPMEN001",
              productBrand: "Classic Fit",
              inStock: true,
              categoryPath: "Men > Shirts > Formal Shirts",
              attributes: { color: "Blue", size: "M" },
            },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FlipkartAffiliateProvider();
    const result = await provider.search({ query: "men formal shirt", audience: "men", limit: 10 });

    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      id: "flipkart:FLIPMEN001",
      price: 1299,
      audience: "men",
      colors: ["Blue"],
      pinCodeAvailability: null,
    });
    expect(result.pinCodeSupported).toBe(false);
    expect(provider.connectionState).toBe("connected");
  });

  it("reports Myntra and AJIO feeds as approval-required until a live request succeeds", async () => {
    const myntra = new RealShoppingProvider({
      id: "myntra",
      label: "Myntra approved feed",
      url: "https://feeds.example.com/myntra",
      approvalRequired: true,
    });
    expect(myntra.connectionState).toBe("verification_pending");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ products: [], total: 0, page: 1, totalPages: 0 })),
    );
    await myntra.search({ query: "shirt" });
    expect(myntra.connectionState).toBe("connected");
  });
});
