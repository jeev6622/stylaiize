import { z } from "zod";
import type { Product, ShoppingProviderState } from "@stylaiize/shared";
import { env } from "@/config/env";
import { inferAudience, inferStyleTags } from "./catalog-attributes";
import type {
  ShoppingProviderHealth,
  ShoppingProviderPort,
  ShoppingSearchInput,
  ShoppingSearchResult,
} from "./shopping.interface";

const TOKEN_URL = "https://api.amazon.co.uk/auth/o2/token";
const API_BASE = "https://creatorsapi.amazon";
const SEARCH_URL = `${API_BASE}/catalog/v1/searchItems`;
const GET_ITEMS_URL = `${API_BASE}/catalog/v1/getItems`;
const MARKETPLACE = "www.amazon.in";
const LABEL = "Amazon India Creators API";
const SOURCE_LABEL = "Amazon India Creators API";
const RESOURCES = [
  "itemInfo.title",
  "itemInfo.byLineInfo",
  "images.primary.large",
  "offersV2.listings.price",
  "offersV2.listings.availability",
  "offersV2.listings.isBuyBoxWinner",
];

const moneySchema = z.object({
  amount: z.coerce.number().finite(),
  currency: z.string().trim().min(1),
});

const listingSchema = z
  .object({
    availability: z.object({ type: z.string().trim().min(1) }).passthrough().optional(),
    price: z
      .object({
        money: moneySchema,
        savingBasis: z.object({ money: moneySchema }).passthrough().optional(),
        savings: z
          .object({ money: moneySchema, percentage: z.coerce.number().finite().optional() })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    isBuyBoxWinner: z.boolean().optional(),
  })
  .passthrough();

const amazonItemSchema = z
  .object({
    asin: z.string().trim().min(1),
    detailPageURL: z.string().trim().url(),
    images: z
      .object({
        primary: z
          .object({
            large: z.object({ url: z.string().trim().url() }).passthrough().optional(),
            medium: z.object({ url: z.string().trim().url() }).passthrough().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    itemInfo: z
      .object({
        title: z.object({ displayValue: z.string().trim().min(1) }).passthrough(),
        byLineInfo: z
          .object({
            brand: z.object({ displayValue: z.string().trim().min(1) }).passthrough().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    offersV2: z.object({ listings: z.array(listingSchema) }).passthrough().optional(),
  })
  .passthrough();

type AmazonItem = z.infer<typeof amazonItemSchema>;

type TokenCache = { token: string; expiresAt: number };

function asinFromId(id: string): string {
  return id.startsWith("amazon:") ? id.slice("amazon:".length) : id;
}

function bestListing(item: AmazonItem) {
  const listings = item.offersV2?.listings ?? [];
  return listings.find((listing) => listing.isBuyBoxWinner) ?? listings[0] ?? null;
}

function mapItem(item: AmazonItem, categoryHint?: string): Product | null {
  const listing = bestListing(item);
  if (!listing?.price) return null;
  const price = listing.price.money;
  if (price.currency !== "INR" || !Number.isFinite(price.amount) || price.amount <= 0) return null;
  const title = item.itemInfo?.title.displayValue ?? "";
  const audience = inferAudience(`${title} ${categoryHint ?? ""}`);
  const availability = listing.availability?.type ?? "";
  const inStock = availability === "IN_STOCK";
  const original = listing.price.savingBasis?.money;
  const discount = listing.price.savings?.percentage ?? null;

  return {
    id: `amazon:${item.asin}`,
    productIdentifier: `amazon-asin:${item.asin}`,
    title,
    brand: item.itemInfo?.byLineInfo?.brand?.displayValue ?? null,
    imageUrl:
      item.images?.primary?.large?.url ?? item.images?.primary?.medium?.url ?? null,
    price: Math.round(price.amount * 100) / 100,
    originalPrice: original?.currency === "INR" && original.amount > price.amount ? original.amount : null,
    currency: "INR",
    discountPercent: discount !== null && Number.isFinite(discount) ? Math.round(discount) : null,
    rating: null,
    reviewCount: null,
    store: "Amazon India",
    deliveryEstimateDays: null,
    buyUrl: item.detailPageURL,
    category: categoryHint ?? "fashion",
    audience,
    styleTags: inferStyleTags(`${title} ${categoryHint ?? ""}`),
    colors: [],
    sizes: [],
    inStock,
    sourceLabel: SOURCE_LABEL,
    priceVerifiedAt: new Date().toISOString(),
    pinCodeAvailability: null,
  };
}

function searchIndexFor(input: ShoppingSearchInput): string {
  const category = (input.category ?? "").toLowerCase();
  if (/shoe|footwear|sandal|heel|boot/.test(category)) return "Shoes";
  if (/watch|jewel|bag|accessor/.test(category)) return "Watches";
  return "Apparel";
}

function requestQuery(input: ShoppingSearchInput): string {
  const audience =
    input.audience && input.audience !== "all" ? `${input.audience === "men" ? "men" : input.audience === "women" ? "women" : "unisex"} ` : "";
  return `${audience}${input.query}`.trim().slice(0, 250);
}

export class AmazonCreatorsProvider implements ShoppingProviderPort {
  readonly demoMode = false;
  readonly id = "amazon_in";
  readonly label = LABEL;
  readonly requiresCredentials = true;
  readonly approvalRequired = true;
  readonly supportsPinCode = false;

  private token: TokenCache | null = null;
  private lastSuccessAt: string | null = null;
  private lastErrorAt: string | null = null;
  private lastMessage: string | null = null;
  private lastAuthError = false;

  get isConfigured(): boolean {
    return Boolean(
      env.AMAZON_CREATORS_CLIENT_ID.trim() &&
        env.AMAZON_CREATORS_CLIENT_SECRET.trim() &&
        env.AMAZON_CREATORS_PARTNER_TAG.trim(),
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
    const message = error instanceof Error ? error.message : "Amazon request failed";
    this.lastErrorAt = new Date().toISOString();
    this.lastMessage = message;
    this.lastAuthError = /authenticat|unauthor|forbidden|401|403/i.test(message);
    if (this.lastAuthError) {
      throw new Error("Amazon Creators authentication failed.");
    }
    throw new Error("Amazon Creators API is temporarily unavailable.");
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.token;
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: env.AMAZON_CREATORS_CLIENT_ID,
        client_secret: env.AMAZON_CREATORS_CLIENT_SECRET,
        scope: "creatorsapi::default",
      }),
    });
    if (!response.ok) throw new Error("Amazon Creators authentication failed.");
    const payload = z
      .object({ access_token: z.string().min(1), expires_in: z.number().finite() })
      .parse(await response.json());
    this.token = {
      token: payload.access_token,
      expiresAt: Date.now() + Math.max(60, payload.expires_in) * 1000,
    };
    return payload.access_token;
  }

  private async post<T>(url: string, body: Record<string, unknown>): Promise<T> {
    if (!this.isConfigured) throw new Error("Amazon Creators approval or credentials required.");
    try {
      const token = await this.accessToken();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-marketplace": MARKETPLACE,
        },
        body: JSON.stringify({
          ...body,
          marketplace: MARKETPLACE,
          languageOfPreference: "en_IN",
          currencyOfPreference: "INR",
        }),
      });
      if (!response.ok) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? "Amazon Creators authentication failed."
            : "Amazon Creators API is temporarily unavailable.",
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
    const payload = await this.post<{ searchResult?: { items?: unknown[]; totalResultCount?: number } }>(
      SEARCH_URL,
      {
        partnerTag: env.AMAZON_CREATORS_PARTNER_TAG,
        keywords: requestQuery(input),
        searchIndex: searchIndexFor(input),
        itemCount: Math.max(1, Math.min(10, input.limit ?? 10)),
        itemPage: input.page ?? 1,
        resources: RESOURCES,
        ...(input.maxPrice !== undefined ? { maxPrice: Math.round(input.maxPrice * 100) } : {}),
      },
    );
    const items = payload.searchResult?.items ?? [];
    const products = items
      .map((raw) => amazonItemSchema.safeParse(raw))
      .filter((parsed) => parsed.success)
      .map((parsed) => mapItem(parsed.data, input.category))
      .filter((product): product is Product => product !== null);
    const total = payload.searchResult?.totalResultCount ?? products.length;
    return {
      products,
      total,
      page: input.page ?? 1,
      totalPages: Math.ceil(total / Math.max(1, input.limit ?? 10)),
      source: "api",
      providerId: this.id,
      providerLabel: this.label,
      checkedAt: new Date().toISOString(),
      pinCodeSupported: false,
      pinCode: input.pinCode ?? null,
    };
  }

  async getById(id: string): Promise<Product | null> {
    const asin = asinFromId(id);
    const payload = await this.post<{ itemsResult?: { items?: unknown[] } }>(GET_ITEMS_URL, {
      itemIds: [asin],
      itemIdType: "ASIN",
      partnerTag: env.AMAZON_CREATORS_PARTNER_TAG,
      resources: RESOURCES,
    });
    const raw = payload.itemsResult?.items?.[0];
    if (!raw) return null;
    const parsed = amazonItemSchema.safeParse(raw);
    return parsed.success ? mapItem(parsed.data) : null;
  }
}
