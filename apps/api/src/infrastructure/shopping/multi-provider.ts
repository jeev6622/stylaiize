import type { Product, ShopAudience, ShopStyleTag, ShoppingProviderState } from "@stylaiize/shared";
import { noApprovedShoppingProviderMessage } from "@stylaiize/shared";
import { env } from "@/config/env";
import { logWarn } from "@/utils/logger";
import { ShoppingUnavailableError } from "./errors";
import type {
  ShoppingProviderHealth,
  ShoppingProviderPort,
  ShoppingProviderStatusEntry,
  ShoppingSearchInput,
  ShoppingSearchResult,
} from "./shopping.interface";

const CACHE_TTL_MS = 2 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

type CacheEntry = {
  value: ShoppingSearchResult;
  expiresAt: number;
};

type ProviderHealth = {
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  message: string | null;
};

const UNMANAGED_PROVIDERS: ShoppingProviderStatusEntry[] = [
  {
    id: "livostyle",
    label: "Livostyle open catalog (MIT)",
    connected: false,
    requiresCredentials: false,
    supported: true,
    state: "not_configured",
    reason: "Free catalog is not selected by SHOPPING_PROVIDER.",
    lastSuccessAt: null,
    lastErrorAt: null,
    lastSuccessfulSyncAt: null,
    rateLimitEvents: 0,
    lastRateLimitedAt: null,
  },
  {
    id: "external_api",
    label: "Approved product API",
    connected: false,
    requiresCredentials: true,
    supported: true,
    state: "not_configured",
    reason: "Set SHOPPING_ENABLED and SHOPPING_API_URL to connect an approved provider.",
    lastSuccessAt: null,
    lastErrorAt: null,
    lastSuccessfulSyncAt: null,
    rateLimitEvents: 0,
    lastRateLimitedAt: null,
  },
  {
    id: "amazon_in",
    label: "Amazon India Creators API",
    connected: false,
    requiresCredentials: true,
    supported: true,
    state: "approval_required",
    reason: "Requires approved Amazon Creators API credentials; no scraping is used.",
    lastSuccessAt: null,
    lastErrorAt: null,
    lastSuccessfulSyncAt: null,
    rateLimitEvents: 0,
    lastRateLimitedAt: null,
  },
  {
    id: "flipkart",
    label: "Flipkart Affiliate API",
    connected: false,
    requiresCredentials: true,
    supported: true,
    state: "approval_required",
    reason: "Requires approved Flipkart Affiliate credentials; no scraping is used.",
    lastSuccessAt: null,
    lastErrorAt: null,
    lastSuccessfulSyncAt: null,
    rateLimitEvents: 0,
    lastRateLimitedAt: null,
  },
  {
    id: "myntra",
    label: "Myntra approved feed",
    connected: false,
    requiresCredentials: true,
    supported: true,
    state: "approval_required",
    reason: "No verified free public product API; an officially supplied feed URL is required.",
    lastSuccessAt: null,
    lastErrorAt: null,
    lastSuccessfulSyncAt: null,
    rateLimitEvents: 0,
    lastRateLimitedAt: null,
  },
  {
    id: "ajio",
    label: "AJIO approved feed",
    connected: false,
    requiresCredentials: true,
    supported: true,
    state: "approval_required",
    reason: "No verified free public product API; an officially supplied feed URL is required.",
    lastSuccessAt: null,
    lastErrorAt: null,
    lastSuccessfulSyncAt: null,
    rateLimitEvents: 0,
    lastRateLimitedAt: null,
  },
  {
    id: "other_approved_feed",
    label: "Other approved product feed",
    connected: false,
    requiresCredentials: true,
    supported: true,
    state: "not_configured",
    reason: "Optional SHOPPING_API_URL can connect one licensed/official product provider.",
    lastSuccessAt: null,
    lastErrorAt: null,
    lastSuccessfulSyncAt: null,
    rateLimitEvents: 0,
    lastRateLimitedAt: null,
  },
];

function dedupeKey(product: Product): string {
  if (product.buyUrl) return `${product.store}|${product.buyUrl}`;
  return `${product.store}|${product.title.toLowerCase()}|${product.brand ?? ""}`;
}

function matchesAudience(product: Product, audience: ShopAudience | undefined): boolean {
  if (!audience || audience === "all") return true;
  const productAudience = product.audience ?? "all";
  if (productAudience === "all") return false;
  if (audience === "unisex") return productAudience === "unisex";
  return productAudience === audience || productAudience === "unisex";
}

function providerSupportsAudience(
  provider: ShoppingProviderPort,
  audience: ShopAudience | undefined,
): boolean {
  if (!audience || audience === "all") return true;
  const supported = provider.supportedAudiences ?? ["men", "women", "unisex", "all"];
  return supported.includes(audience);
}

function matchesRequestedStyle(product: Product, style: string | undefined): boolean {
  if (!style) return true;
  const requested = style
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token): token is ShopStyleTag => ["traditional", "western", "formal", "casual", "ethnic", "sports"].includes(token));
  if (requested.length === 0) return true;
  return requested.some((tag) => product.styleTags.includes(tag));
}

function sortProducts(products: Product[], sortBy?: ShoppingSearchInput["sortBy"]): Product[] {
  const sorted = [...products];
  switch (sortBy) {
    case "price_asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price_desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
      break;
    case "discount":
      sorted.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));
      break;
    default:
      break;
  }
  return sorted;
}

export class MultiShoppingProvider implements ShoppingProviderPort {
  readonly id = "multi";
  readonly label = "Connected shopping providers";
  readonly requiresCredentials = false;
  readonly supportsPinCode = true;

  private readonly cache = new Map<string, CacheEntry>();
  private readonly rateLimit = new Map<string, number[]>();
  private readonly healthState = new Map<string, ProviderHealth>();
  private readonly rateLimitEvents = new Map<string, { count: number; lastAt: string | null }>();

  constructor(private readonly providers: ShoppingProviderPort[]) {}

  get demoMode(): boolean {
    return this.providers.length > 0 && this.providers.every((provider) => provider.demoMode);
  }

  get isConfigured(): boolean {
    return this.providers.some((provider) => provider.isConfigured);
  }

  get activeProviderIds(): string[] {
    return this.providers
      .filter((provider) => provider.isConfigured)
      .map((provider) => provider.id ?? provider.label ?? "unknown");
  }

  healthFor(provider: ShoppingProviderPort): ShoppingProviderHealth {
    const reported = provider.health?.();
    if (reported) return reported;
    const tracked = this.healthState.get(provider.id ?? provider.label ?? "unknown");
    return {
      status: tracked?.lastErrorAt
        ? "unhealthy"
        : tracked?.lastSuccessAt
          ? "healthy"
          : "unknown",
      lastSuccessAt: tracked?.lastSuccessAt ?? null,
      lastErrorAt: tracked?.lastErrorAt ?? null,
      message: tracked?.message ?? null,
    };
  }

  private stateFor(
    provider: ShoppingProviderPort,
    health: ShoppingProviderHealth,
  ): ShoppingProviderState {
    if (!provider.isConfigured) {
      return provider.approvalRequired ? "approval_required" : "not_configured";
    }
    if (provider.connectionState) return provider.connectionState;
    const failedAfterSuccess =
      health.lastErrorAt && (!health.lastSuccessAt || health.lastErrorAt > health.lastSuccessAt);
    if (failedAfterSuccess) {
      return /auth|401|403/i.test(health.message ?? "")
        ? "authentication_failed"
        : "temporarily_unavailable";
    }
    if (health.lastSuccessAt) return "connected";
    return "verification_pending";
  }

  describeProviders(): ShoppingProviderStatusEntry[] {
    const managed = this.providers.map((provider) => {
      const id = provider.id ?? provider.label ?? "unknown";
      const health = this.healthFor(provider);
      const state = this.stateFor(provider, health);
      const rateLimit = this.rateLimitEvents.get(id) ?? { count: 0, lastAt: null };
      return {
        id,
        label: provider.label ?? id,
        connected: provider.isConfigured,
        requiresCredentials: provider.requiresCredentials ?? false,
        supported: true,
        state,
        reason:
          state === "approval_required"
            ? "Approval or credentials required."
            : state === "not_configured"
              ? "Provider credentials or feed access are not configured."
              : state === "authentication_failed"
                ? "Authentication failed. Recheck approved backend credentials."
                : state === "temporarily_unavailable"
                  ? (health.message ?? "The provider is temporarily unavailable.")
                  : state === "verification_pending"
                    ? "Configured; awaiting the first successful live request."
                    : (health.message ?? "Verified by a successful live request."),
        lastSuccessAt: health.lastSuccessAt,
        lastErrorAt: health.lastErrorAt,
        lastSuccessfulSyncAt: health.lastSuccessAt,
        rateLimitEvents: rateLimit.count,
        lastRateLimitedAt: rateLimit.lastAt,
        supportedAudiences: provider.supportedAudiences
          ? [...provider.supportedAudiences]
          : undefined,
      };
    });
    const unmanaged = UNMANAGED_PROVIDERS.filter(
      (entry) => !managed.some((item) => item.id === entry.id),
    );
    return [
      ...managed,
        ...unmanaged.map((entry) => {
          const configured =
            entry.id === "other_approved_feed" &&
            Boolean(env.SHOPPING_ENABLED && env.SHOPPING_API_URL.trim());
          const managedEntry = managed.find((item) => item.id === entry.id);
          const withScope = {
            ...entry,
            supportedAudiences:
              entry.id === "livostyle"
                ? (["women"] as ShopAudience[])
                : (["men", "women", "unisex", "all"] as ShopAudience[]),
          };
          return configured
            ? {
                ...withScope,
                connected: true,
                state: "verification_pending" as const,
                reason: "Configured; awaiting the first successful live request.",
              }
            : managedEntry && managedEntry.connected
              ? { ...managedEntry }
              : withScope;
        }),
    ];
  }

  private allowRequest(provider: ShoppingProviderPort): boolean {
    const id = provider.id ?? provider.label ?? "unknown";
    const now = Date.now();
    const recent = (this.rateLimit.get(id) ?? []).filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
    );
    if (recent.length >= RATE_LIMIT_MAX) {
      const current = this.rateLimitEvents.get(id) ?? { count: 0, lastAt: null };
      this.rateLimitEvents.set(id, { count: current.count + 1, lastAt: new Date().toISOString() });
      logWarn(`[Shopping] Provider ${id} rate limited`);
      return false;
    }
    recent.push(now);
    this.rateLimit.set(id, recent);
    return true;
  }

  private markSuccess(id: string): void {
    const current = this.healthState.get(id) ?? {
      lastSuccessAt: null,
      lastErrorAt: null,
      message: null,
    };
    this.healthState.set(id, {
      ...current,
      lastSuccessAt: new Date().toISOString(),
      message: null,
    });
  }

  private markFailure(id: string, message: string): void {
    const current = this.healthState.get(id) ?? {
      lastSuccessAt: null,
      lastErrorAt: null,
      message: null,
    };
    this.healthState.set(id, {
      ...current,
      lastErrorAt: new Date().toISOString(),
      message,
    });
  }

  async search(input: ShoppingSearchInput): Promise<ShoppingSearchResult> {
    const cacheKey = JSON.stringify(input);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const capableProviders = this.providers.filter(
      (provider) => provider.isConfigured && providerSupportsAudience(provider, input.audience),
    );
    if (input.audience && input.audience !== "all" && capableProviders.length === 0) {
      return {
        products: [],
        total: 0,
        page: input.page ?? 1,
        totalPages: 0,
        source: "api",
        providerId: "none",
        providerLabel: "No approved provider",
        checkedAt: new Date().toISOString(),
        pinCodeSupported: false,
        pinCode: input.pinCode ?? null,
        notice: noApprovedShoppingProviderMessage(input.audience),
      };
    }

    const searches = await Promise.all(
      capableProviders.map(async (provider) => {
        const id = provider.id ?? provider.label ?? "unknown";
        if (!provider.isConfigured || !this.allowRequest(provider)) return null;
        try {
          const result = await provider.search({
            ...input,
            ...(provider.supportsPinCode === false ? { pinCode: undefined } : {}),
          });
          this.markSuccess(id);
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Provider search failed";
          this.markFailure(id, message);
          logWarn(`[Shopping] Provider ${id} failed: ${message}`);
          return null;
        }
      }),
    );

    const successful = searches.filter(
      (result): result is ShoppingSearchResult => result !== null,
    );
    if (successful.length === 0) throw new ShoppingUnavailableError();

    const notice =
      input.audience && input.audience !== "all" && capableProviders.length === 0
        ? noApprovedShoppingProviderMessage(input.audience)
        : null;

    const seen = new Set<string>();
    const products: Product[] = [];
    for (const result of successful) {
      for (const product of result.products) {
        if (!matchesAudience(product, input.audience)) continue;
        if (!matchesRequestedStyle(product, input.style)) continue;
        const key = dedupeKey(product);
        if (seen.has(key)) continue;
        seen.add(key);
        products.push(product);
      }
    }

    const sorted = sortProducts(products, input.sortBy);
    const page = input.page ?? 1;
    const limit = input.limit ?? 12;
    const start = (page - 1) * limit;
    const checkedAt =
      successful.map((result) => result.checkedAt).filter(Boolean).sort().pop() ??
      new Date().toISOString();
    const value: ShoppingSearchResult = {
      products: sorted.slice(start, start + limit),
      total: sorted.length,
      page,
      totalPages: limit > 0 ? Math.ceil(sorted.length / limit) : 0,
      source: successful.some((result) => !providerIsDemo(result))
        ? "api"
        : "mock",
      fx: successful.find((result) => result.fx)?.fx ?? null,
      providerId: successful.map((result) => result.providerId).filter(Boolean).join(",") || "multi",
      providerLabel: successful
        .map((result) => result.providerLabel)
        .filter(Boolean)
        .join(" + "),
      checkedAt,
      pinCodeSupported: successful.some((result) => result.pinCodeSupported),
      pinCode: input.pinCode ?? null,
      notice,
    };

    this.cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  async getById(id: string): Promise<Product | null> {
    for (const provider of this.providers) {
      if (!provider.isConfigured) continue;
      try {
        const product = await provider.getById(id);
        if (product) return product;
      } catch {
        continue;
      }
    }
    return null;
  }
}

function providerIsDemo(result: ShoppingSearchResult): boolean {
  return result.source === "mock";
}
