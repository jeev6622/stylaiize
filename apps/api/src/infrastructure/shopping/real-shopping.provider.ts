import { z } from "zod";
import { env } from "@/config/env";
import { isShoppingConfigured } from "@/config/features";
import { logError, logInfo, logWarn } from "@/utils/logger";
import { ShoppingNotConfiguredError } from "./errors";
import type {
  ShoppingProviderHealth,
  ShoppingProviderPort,
  ShoppingSearchInput,
  ShoppingSearchResult,
} from "./shopping.interface";
import type { Product, ShoppingProviderState } from "@stylaiize/shared";
import {
  SHOP_AUDIENCES,
  SHOP_STYLE_TAGS,
} from "@stylaiize/shared";
import { inferAudience, inferStyleTags } from "./catalog-attributes";

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((v) => /^https?:\/\//i.test(v), "must be an http(s) URL");

const finiteNumber = z.coerce.number().finite();

const pinCodeAvailabilitySchema = z
  .object({
    supported: z.boolean(),
    pinCode: z.string().trim().max(20).nullable().optional(),
    available: z.boolean().nullable().optional(),
    deliveryEstimateDays: z
      .object({
        min: z.coerce.number().int().min(0),
        max: z.coerce.number().int().min(0),
      })
      .nullable()
      .optional(),
    deliveryDate: z
      .object({
        min: z.string().trim().min(1).max(80),
        max: z.string().trim().min(1).max(80),
      })
      .nullable()
      .optional(),
    deliveryChargesInr: finiteNumber.min(0).nullable().optional(),
    availableSizes: z.array(z.string().trim().min(1).max(20)).max(50).nullable().optional(),
    availableColors: z.array(z.string().trim().min(1).max(40)).max(50).nullable().optional(),
    message: z.string().trim().min(1).max(300).optional(),
    checkedAt: z.string().datetime().nullable().optional(),
  })
  .transform((raw) => {
    const supported = raw.supported && typeof raw.available === "boolean";
    return {
      supported,
      pinCode: raw.pinCode ?? null,
      available: supported ? raw.available : null,
      deliveryEstimateDays: supported ? (raw.deliveryEstimateDays ?? null) : null,
      deliveryDate: supported ? (raw.deliveryDate ?? null) : null,
      deliveryChargesInr: supported ? (raw.deliveryChargesInr ?? null) : null,
      availableSizes: supported ? (raw.availableSizes ?? []) : null,
      availableColors: supported ? (raw.availableColors ?? []) : null,
      message: supported
        ? (raw.message ?? "Availability confirmed by the retailer.")
        : "Please confirm delivery availability on the retailer's website.",
      checkedAt: raw.checkedAt ?? new Date().toISOString(),
    };
  });

const productSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(300),
    brand: z.string().trim().min(1).max(120).nullable().default(null),
    imageUrl: httpUrl.nullable().default(null),
    price: finiteNumber.min(0),
    originalPrice: finiteNumber.min(0).nullable().default(null),
    currency: z.string().trim().min(1).max(10),
    discountPercent: finiteNumber.min(0).max(100).nullable().default(null),
    rating: finiteNumber.min(0).max(5).nullable().default(null),
    reviewCount: z.coerce.number().int().min(0).nullable().default(null),
    store: z.string().trim().min(1).max(120),
    deliveryEstimateDays: z
      .object({
        min: z.coerce.number().int().min(0),
        max: z.coerce.number().int().min(0),
      })
      .nullable()
      .default(null),
    buyUrl: httpUrl,
    category: z.string().trim().min(1).max(80),
    audience: z.enum(SHOP_AUDIENCES).optional().nullable(),
    styleTags: z.array(z.enum(SHOP_STYLE_TAGS)).max(20).optional().nullable(),
    pinCodeAvailability: pinCodeAvailabilitySchema.optional().nullable(),
    colors: z.array(z.string().trim().min(1).max(40)).max(50).default([]),
    sizes: z.array(z.string().trim().min(1).max(20)).max(50).default([]),
    inStock: z.boolean().default(true),
    sku: z.string().trim().min(1).max(120).nullable().optional(),
    priceVerifiedAt: z.string().datetime().nullable().optional(),
  })
  .transform((value): Product => {
    return {
      id: value.id,
      title: value.title,
      brand: value.brand,
      imageUrl: value.imageUrl,
      price: value.price,
      originalPrice: value.originalPrice,
      currency: value.currency.toUpperCase(),
      discountPercent: value.discountPercent,
      rating: value.rating,
      reviewCount: value.reviewCount,
      store: value.store,
      deliveryEstimateDays: value.deliveryEstimateDays,
      buyUrl: value.buyUrl,
      category: value.category,
      audience: value.audience ?? inferAudience(`${value.title} ${value.category}`),
      styleTags:
        value.styleTags && value.styleTags.length > 0
          ? value.styleTags
          : inferStyleTags(`${value.title} ${value.category}`),
      pinCodeAvailability: value.pinCodeAvailability ?? null,
      colors: value.colors,
      sizes: value.sizes,
      inStock: value.inStock,
      productIdentifier: value.sku ?? null,
      priceVerifiedAt: value.priceVerifiedAt ?? null,
    };
  });

const searchResponseSchema = z.object({
  products: z.array(z.unknown()).default([]),
  total: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).optional(),
  totalPages: z.coerce.number().int().min(0).optional(),
});

const productResponseSchema = z.object({ product: z.unknown().optional() });

function parseProducts(raw: unknown[]): Product[] {
  const products: Product[] = [];
  for (const entry of raw) {
    const result = productSchema.safeParse(entry);
    if (result.success) products.push(result.data);
  }
  if (products.length < raw.length) {
    logWarn(`[Shopping] Discarded ${raw.length - products.length} malformed live products`);
  }
  return products;
}

type ApprovedFeedConfig = {
  id: string;
  label: string;
  url: string;
  apiKey: string;
  approvalRequired: boolean;
};

export class RealShoppingProvider implements ShoppingProviderPort {
  readonly demoMode = false;
  readonly id: string;
  readonly label: string;
  readonly requiresCredentials = true;
  readonly approvalRequired: boolean;
  readonly supportsPinCode = true;

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private lastSuccessAt: string | null = null;
  private lastErrorAt: string | null = null;
  private lastError: string | null = null;

  constructor(config?: Partial<ApprovedFeedConfig>) {
    this.id = config?.id ?? "external_api";
    this.label = config?.label ?? env.SHOPPING_PROVIDER_LABEL ?? "Approved product API";
    this.baseUrl = config?.url ?? env.SHOPPING_API_URL;
    this.apiKey = config?.apiKey ?? env.SHOPPING_API_KEY;
    this.approvalRequired = config?.approvalRequired ?? false;
  }

  get isConfigured(): boolean {
    if (this.id !== "external_api") return this.baseUrl.trim().length > 0;
    return isShoppingConfigured;
  }

  get connectionState(): ShoppingProviderState {
    if (!this.isConfigured) {
      return this.approvalRequired ? "approval_required" : "not_configured";
    }
    if (this.lastSuccessAt && (!this.lastErrorAt || this.lastSuccessAt > this.lastErrorAt)) {
      return "connected";
    }
    if (this.lastErrorAt && /401|403|unauthor|authenticat/i.test(this.lastError ?? "")) {
      return "authentication_failed";
    }
    if (this.lastErrorAt) return "temporarily_unavailable";
    return "verification_pending";
  }

  health(): ShoppingProviderHealth {
    return {
      status:
        this.lastErrorAt && (!this.lastSuccessAt || this.lastErrorAt > this.lastSuccessAt)
          ? "unhealthy"
          : this.lastSuccessAt
            ? "healthy"
            : "unknown",
      lastSuccessAt: this.lastSuccessAt,
      lastErrorAt: this.lastErrorAt,
      message: this.lastError,
    };
  }

  async search(input: ShoppingSearchInput): Promise<ShoppingSearchResult> {
    if (!this.isConfigured) {
      throw new ShoppingNotConfiguredError();
    }

    const params = new URLSearchParams({
      q: input.query,
      ...(input.category && { category: input.category }),
      ...(input.minPrice && { minPrice: String(input.minPrice) }),
      ...(input.maxPrice && { maxPrice: String(input.maxPrice) }),
      ...(input.sortBy && { sortBy: input.sortBy }),
      ...(input.page && { page: String(input.page) }),
      ...(input.limit && { limit: String(input.limit) }),
      ...(input.pinCode && { pinCode: input.pinCode }),
      ...(input.audience && { audience: input.audience }),
      ...(input.style && { style: input.style }),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const url = `${this.baseUrl.replace(/\/$/, "")}/search?${params}`;
      const res = await fetch(url, {
        headers: {
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Shopping API returned ${res.status}`);
      }

      const parsed = searchResponseSchema.safeParse(await res.json());
      if (!parsed.success) {
        throw new Error("Shopping API returned an invalid search response");
      }
      const products = parseProducts(parsed.data.products);

      this.lastSuccessAt = new Date().toISOString();
      this.lastError = null;
      logInfo(`[Shopping] API search: ${products.length} valid results for "${input.query}"`);

      return {
        products,
        total: parsed.data.total ?? products.length,
        page: parsed.data.page ?? input.page ?? 1,
        totalPages: parsed.data.totalPages ?? 0,
        source: "api",
        providerId: this.id,
        providerLabel: this.label,
        checkedAt: this.lastSuccessAt,
        pinCodeSupported: true,
        pinCode: input.pinCode ?? null,
      };
    } catch (err) {
      this.lastErrorAt = new Date().toISOString();
      this.lastError = err instanceof Error ? err.message : "Shopping API search failed";
      logError("Shopping API search failed", err);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getById(id: string): Promise<Product | null> {
    if (!this.isConfigured) return null;

    try {
      const url = `${this.baseUrl.replace(/\/$/, "")}/product/${id}`;
      const res = await fetch(url, {
        headers: {
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) return null;
      const parsed = productResponseSchema.safeParse(await res.json());
      if (!parsed.success) return null;
      const product = productSchema.safeParse(parsed.data.product);
      return product.success ? product.data : null;
    } catch (err) {
      logError("Shopping API getById failed", err);
      return null;
    }
  }
}
