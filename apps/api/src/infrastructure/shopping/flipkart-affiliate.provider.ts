import { z } from "zod";
import type { ShoppingProviderState } from "@stylaiize/shared";
import { env } from "@/config/env";
import { inferAudience, inferStyleTags } from "./catalog-attributes";
import type {
  ShoppingProviderHealth,
  ShoppingProviderPort,
  ShoppingSearchInput,
  ShoppingSearchResult,
} from "./shopping.interface";

const API_BASE = "https://affiliate-api.flipkart.net/affiliate";
const SEARCH_URL = `${API_BASE}/1.0/search.json`;
const PRODUCT_URL = `${API_BASE}/1.0/product.json`;
const LABEL = "Flipkart Affiliate API";
const SOURCE_LABEL = "Flipkart Affiliate API";

const priceSchema = z.object({
  amount: z.coerce.number().finite(),
  currency: z.string().trim().min(1),
});

const flipkartProductSchema = z
  .object({
    productBaseInfoV1: z
      .object({
        productId: z.string().trim().min(1),
        title: z.string().trim().min(1),
        productDescription: z.string().optional().nullable(),
        imageUrls: z.record(z.string().trim().url()).optional().nullable(),
        maximumRetailPrice: priceSchema.optional().nullable(),
        flipkartSellingPrice: priceSchema.optional().nullable(),
        flipkartSpecialPrice: priceSchema.optional().nullable(),
        productUrl: z.string().trim().url(),
        productBrand: z.string().trim().optional().nullable(),
        inStock: z.boolean().optional().nullable(),
        discountPercentage: z.coerce.number().finite().optional().nullable(),
        categoryPath: z.string().optional().nullable(),
        styleCode: z.string().optional().nullable(),
        attributes: z
          .object({
            size: z.string().optional().nullable(),
            color: z.string().optional().nullable(),
          })
          .passthrough()
          .optional()
          .nullable(),
      })
      .passthrough(),
    categorySpecificInfoV1: z
      .object({
        specificationList: z.array(z.unknown()).optional().nullable(),
      })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

type FlipkartProduct = z.infer<typeof flipkartProductSchema>;

function categoryText(product: FlipkartProduct): string {
  return [product.productBaseInfoV1.categoryPath ?? "", product.productBaseInfoV1.title].join(" ");
}

function imageUrl(product: FlipkartProduct): string | null {
  const images = product.productBaseInfoV1.imageUrls;
  if (!images) return null;
  return images["400x400"] ?? images["800x800"] ?? images["200x200"] ?? images["unknown"] ?? null;
}

function mapProduct(product: FlipkartProduct): import("@stylaiize/shared").Product | null {
  const base = product.productBaseInfoV1;
  const price = base.flipkartSpecialPrice ?? base.flipkartSellingPrice;
  if (!price || price.currency !== "INR" || !Number.isFinite(price.amount) || price.amount <= 0) {
    return null;
  }
  const original = base.maximumRetailPrice;
  const context = categoryText(product);
  const color = base.attributes?.color?.trim();
  const size = base.attributes?.size?.trim();
  const discount =
    base.discountPercentage !== null && base.discountPercentage !== undefined
      ? Math.round(base.discountPercentage)
      : original && original.amount > price.amount
        ? Math.round(((original.amount - price.amount) / original.amount) * 100)
        : null;

  return {
    id: `flipkart:${base.productId}`,
    productIdentifier: `flipkart:${base.productId}`,
    title: base.title,
    brand: base.productBrand?.trim() || null,
    imageUrl: imageUrl(product),
    price: Math.round(price.amount * 100) / 100,
    originalPrice: original?.currency === "INR" && original.amount > price.amount ? original.amount : null,
    currency: "INR",
    discountPercent: discount,
    rating: null,
    reviewCount: null,
    store: "Flipkart",
    deliveryEstimateDays: null,
    buyUrl: base.productUrl,
    category: "fashion",
    audience: inferAudience(`${context} ${JSON.stringify(product.categorySpecificInfoV1 ?? {})}`),
    styleTags: inferStyleTags(context),
    colors: color ? [color] : [],
    sizes: size ? [size] : [],
    inStock: base.inStock === true,
    sourceLabel: SOURCE_LABEL,
    priceVerifiedAt: new Date().toISOString(),
    pinCodeAvailability: null,
  };
}

export class FlipkartAffiliateProvider implements ShoppingProviderPort {
  readonly demoMode = false;
  readonly id = "flipkart";
  readonly label = LABEL;
  readonly requiresCredentials = true;
  readonly approvalRequired = true;
  readonly supportsPinCode = false;

  private lastSuccessAt: string | null = null;
  private lastErrorAt: string | null = null;
  private lastMessage: string | null = null;
  private lastAuthError = false;

  get isConfigured(): boolean {
    return Boolean(
      env.FLIPKART_AFFILIATE_ID.trim() && env.FLIPKART_AFFILIATE_TOKEN.trim(),
    );
  }

  get connectionState(): ShoppingProviderState {
    if (!this.isConfigured) return "approval_required";
    if (this.lastSuccessAt && (!this.lastErrorAt || this.lastSuccessAt > this.lastErrorAt)) {
      return "connected";
    }
    if (this.lastAuthError) return "authentication_failed";
    if (this.lastErrorAt) return "temporarily_unavailable";
    return "verification_pending";
  }

  health(): ShoppingProviderHealth {
    return {
      status: this.lastErrorAt ? "unhealthy" : this.lastSuccessAt ? "healthy" : "unknown",
      lastSuccessAt: this.lastSuccessAt,
      lastErrorAt: this.lastErrorAt,
      message: this.lastMessage,
    };
  }

  private markSuccess(): void {
    this.lastSuccessAt = new Date().toISOString();
    this.lastMessage = null;
    this.lastAuthError = false;
  }

  private markFailure(error: unknown): never {
    const message = error instanceof Error ? error.message : "Flipkart request failed";
    this.lastErrorAt = new Date().toISOString();
    this.lastMessage = message;
    this.lastAuthError = /authenticat|unauthor|forbidden|401|403/i.test(message);
    if (this.lastAuthError) {
      throw new Error("Flipkart Affiliate authentication failed.");
    }
    throw new Error("Flipkart Affiliate API is temporarily unavailable.");
  }

  private async get<T>(url: string): Promise<T> {
    if (!this.isConfigured) throw new Error("Flipkart Affiliate approval or credentials required.");
    try {
      const response = await fetch(url, {
        headers: {
          "Fk-Affiliate-Id": env.FLIPKART_AFFILIATE_ID,
          "Fk-Affiliate-Token": env.FLIPKART_AFFILIATE_TOKEN,
        },
      });
      if (!response.ok) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? "Flipkart Affiliate authentication failed."
            : "Flipkart Affiliate API is temporarily unavailable.",
        );
      }
      const value = (await response.json()) as T;
      this.markSuccess();
      return value;
    } catch (error) {
      this.markFailure(error);
    }
  }

  async search(input: ShoppingSearchInput): Promise<ShoppingSearchResult> {
    const params = new URLSearchParams({
      query: input.query,
      resultCount: String(Math.max(1, Math.min(20, input.limit ?? 10))),
    });
    const payload = await this.get<{ productInfoList?: unknown[] }>(`${SEARCH_URL}?${params}`);
    const products = (payload.productInfoList ?? [])
      .map((raw) => flipkartProductSchema.safeParse(raw))
      .filter((parsed) => parsed.success)
      .map((parsed) => mapProduct(parsed.data))
      .filter((product): product is import("@stylaiize/shared").Product => product !== null);
    const total = products.length;
    return {
      products,
      total,
      page: input.page ?? 1,
      totalPages: 1,
      source: "api",
      providerId: this.id,
      providerLabel: this.label,
      checkedAt: new Date().toISOString(),
      pinCodeSupported: false,
      pinCode: input.pinCode ?? null,
    };
  }

  async getById(id: string): Promise<import("@stylaiize/shared").Product | null> {
    const productId = id.startsWith("flipkart:") ? id.slice("flipkart:".length) : id;
    const params = new URLSearchParams({ id: productId });
    const payload = await this.get<{ productInfoList?: unknown[] }>(`${PRODUCT_URL}?${params}`);
    const raw = payload.productInfoList?.[0];
    if (!raw) return null;
    const parsed = flipkartProductSchema.safeParse(raw);
    return parsed.success ? mapProduct(parsed.data) : null;
  }
}
