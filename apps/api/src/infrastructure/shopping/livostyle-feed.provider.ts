import { z } from "zod";
import {
  SHOP_STYLE_TAGS,
  type Product,
  type ShopStyleTag,
  type ShoppingProviderState,
} from "@stylaiize/shared";
import { inferStyleTags } from "./catalog-attributes";
import { getUsdToInrRate, type Rate } from "./currency";
import { ShoppingUnavailableError } from "./errors";
import type {
  ShoppingProviderHealth,
  ShoppingProviderPort,
  ShoppingSearchInput,
  ShoppingSearchResult,
} from "./shopping.interface";

const FEED_URL =
  "https://raw.githubusercontent.com/arturayupov/womens-fashion-catalog-open-data/main/data/products.json";
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const SOURCE_LABEL = "Livostyle open catalog (MIT)";

const finite = z.coerce.number().finite();
const httpUrl = z.string().trim().url().refine((v) => /^https?:\/\//i.test(v));

const variantSchema = z
  .object({
    title: z.string().optional(),
    price_usd: finite.optional(),
    compare_at_price_usd: finite.nullable().optional(),
    in_stock: z.boolean().optional(),
    options: z.record(z.unknown()).optional(),
  })
  .passthrough();

const sourceProductSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    handle: z.string().optional(),
    title: z.string().trim().min(1),
    url: httpUrl,
    product_type: z.string().optional(),
    vendor: z.string().optional(),
    description: z.string().optional(),
    category: z
      .object({
        name: z.string().optional(),
        full_path: z.string().optional(),
      })
      .passthrough()
      .optional(),
    price: z
      .object({
        min_usd: finite.optional(),
        max_usd: finite.optional(),
      })
      .passthrough()
      .optional(),
    images: z.array(z.object({ url: httpUrl }).passthrough()).optional(),
    featured_image_url: httpUrl.optional(),
    variants: z.array(variantSchema).optional(),
    reviews: z
      .object({
        rating: finite.optional(),
        count: finite.optional(),
      })
      .passthrough()
      .optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

type SourceProduct = z.infer<typeof sourceProductSchema>;

type CatalogEntry = {
  id: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  usdPrice: number;
  usdOriginalPrice: number | null;
  rating: number | null;
  reviewCount: number | null;
  buyUrl: string;
  category: string;
  colors: string[];
  sizes: string[];
  inStock: boolean;
  searchText: string;
  categoryText: string;
  styleTags: ShopStyleTag[];
};

type CachedCatalog = {
  entries: CatalogEntry[];
  expiresAt: number;
  verifiedAt: string;
};

let cached: CachedCatalog | null = null;
let inFlight: Promise<CatalogEntry[]> | null = null;

function safeUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function optionValues(
  variants: SourceProduct["variants"],
  kind: "color" | "size",
): string[] {
  const values = new Set<string>();
  for (const variant of variants ?? []) {
    for (const [key, raw] of Object.entries(variant.options ?? {})) {
      if (typeof raw !== "string" && typeof raw !== "number") continue;
      const label = key.toLowerCase();
      const matches =
        kind === "color"
          ? label.includes("color") || label.includes("colour")
          : label.includes("size");
      if (!matches) continue;
      const value = String(raw).trim();
      if (value) values.add(value.slice(0, 40));
    }
    if (kind === "size" && !variant.options && variant.title) {
      const value = variant.title.trim();
      if (value) values.add(value.slice(0, 40));
    }
  }
  return [...values].slice(0, 20);
}

function normalizeProduct(raw: SourceProduct): CatalogEntry | null {
  const usdPrice = raw.price?.min_usd;
  if (typeof usdPrice !== "number" || !Number.isFinite(usdPrice) || usdPrice <= 0) {
    return null;
  }

  const id = slug(raw.handle ?? String(raw.id ?? ""));
  if (!id) return null;

  const compareAt = (raw.variants ?? [])
    .map((variant) => variant.compare_at_price_usd)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > usdPrice);
  const usdOriginalPrice = compareAt.length > 0 ? Math.max(...compareAt) : null;
  const category = raw.product_type?.trim() || raw.category?.name?.trim() || "fashion";
  const tags = raw.tags ?? [];
  const categoryText = [
    category,
    raw.category?.name ?? "",
    raw.category?.full_path ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const colors = optionValues(raw.variants, "color");
  const searchText = [
    raw.title,
    categoryText,
    tags.join(" "),
    raw.vendor ?? "",
    colors.join(" "),
    raw.description?.slice(0, 500) ?? "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    id: `livostyle-${id}`,
    title: raw.title.trim().slice(0, 200),
    brand: raw.vendor?.trim() ? raw.vendor.trim().slice(0, 120) : null,
    imageUrl:
      safeUrl(raw.featured_image_url) ??
      safeUrl(raw.images?.find((image) => safeUrl(image.url))?.url),
    usdPrice,
    usdOriginalPrice,
    rating:
      typeof raw.reviews?.rating === "number" && raw.reviews.rating >= 0 && raw.reviews.rating <= 5
        ? raw.reviews.rating
        : null,
    reviewCount:
      typeof raw.reviews?.count === "number" && raw.reviews.count >= 0
        ? Math.round(raw.reviews.count)
        : null,
    buyUrl: raw.url,
    category: category.slice(0, 80),
    colors,
    sizes: optionValues(raw.variants, "size"),
    inStock: (raw.variants ?? []).some((variant) => variant.in_stock !== false),
    searchText,
    categoryText: categoryText.toLowerCase(),
    styleTags: inferStyleTags(searchText),
  };
}

async function loadCatalog(): Promise<CatalogEntry[]> {
  if (cached && cached.expiresAt > Date.now()) return cached.entries;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(FEED_URL, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Catalog feed returned ${response.status}`);
      const raw = z.array(z.unknown()).safeParse(await response.json());
      if (!raw.success) throw new Error("Catalog feed returned an invalid catalog");
      const entries = raw.data
        .map((item) => sourceProductSchema.safeParse(item))
        .filter((result): result is z.SafeParseSuccess<SourceProduct> => result.success)
        .map((result) => normalizeProduct(result.data))
        .filter((entry): entry is CatalogEntry => entry !== null);
      if (entries.length === 0) throw new Error("Catalog feed returned no usable products");
      cached = {
        entries,
        expiresAt: Date.now() + CATALOG_TTL_MS,
        verifiedAt: new Date().toISOString(),
      };
      return entries;
    } catch {
      throw new ShoppingUnavailableError();
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

const CATEGORY_TERMS: Record<string, string[]> = {
  tops: ["top", "blouse", "shirt", "t-shirt", "tee", "tank", "sweater", "hoodie", "cardigan", "bodysuit", "crop", "camisole"],
  upperwear: ["top", "blouse", "shirt", "t-shirt", "tee", "tank", "sweater", "hoodie", "jacket", "coat", "blazer", "cardigan", "outerwear"],
  bottoms: ["bottom", "pants", "jeans", "leggings", "joggers", "skirt", "shorts", "trousers"],
  lowerwear: ["bottom", "pants", "jeans", "leggings", "joggers", "skirt", "shorts", "trousers"],
  dresses: ["dress", "gown", "jumpsuit", "romper"],
  footwear: ["shoe", "sneaker", "heel", "sandal", "boot", "footwear", "slipper"],
  accessories: ["accessory", "accessories", "bag", "jewelry", "jewellery", "belt", "scarf", "sunglasses", "hat", "watch", "bracelet", "necklace", "earring"],
  ethnic: ["kurta", "sari", "salwar", "lehenga", "ethnic"],
  outerwear: ["jacket", "coat", "blazer", "outerwear", "shacket", "trench"],
  bags: ["bag", "handbag", "tote", "backpack", "purse"],
};

function matchesCategory(entry: CatalogEntry, category: string | undefined): boolean {
  if (!category || category === "all") return true;
  const terms = CATEGORY_TERMS[category.toLowerCase()] ?? [category.toLowerCase()];
  const haystack = `${entry.categoryText} ${entry.searchText}`;
  return terms.some((term) => haystack.includes(term));
}

function matchesStyle(entry: CatalogEntry, style: string | undefined): boolean {
  if (!style) return true;
  const requested = SHOP_STYLE_TAGS.filter((tag) =>
    new RegExp(`\\b${tag}\\b`).test(style.toLowerCase()),
  );
  if (requested.length === 0) return true;
  return requested.some((tag) => entry.styleTags.includes(tag));
}

const QUERY_ALIASES: Record<string, string[]> = {
  shirt: ["shirt", "shirts", "button-up", "button down", "linen shirt"],
  top: ["top", "tops", "blouse", "tee", "t-shirt", "tshirt"],
  tee: ["tee", "t-shirt", "tshirt"],
  trouser: ["trouser", "trousers", "pant", "pants", "chino", "chinos"],
  pant: ["pant", "pants", "trouser", "trousers", "chino", "chinos"],
  jeans: ["jeans", "denim", "jean"],
  shoe: ["shoe", "shoes", "loafer", "loafers", "sneaker", "sneakers"],
  sneaker: ["sneaker", "sneakers", "trainer", "trainers", "shoe"],
  loafer: ["loafer", "loafers", "shoe"],
  dress: ["dress", "dresses", "gown"],
  skirt: ["skirt", "skirts"],
  jacket: ["jacket", "blazer", "coat", "outerwear"],
  bag: ["bag", "bags", "handbag", "tote", "purse"],
  watch: ["watch", "watches"],
  sunglass: ["sunglass", "sunglasses", "shades"],
  belt: ["belt", "belts"],
  scarf: ["scarf", "scarves"],
  jewel: ["jewel", "jewelry", "jewellery", "necklace", "earring"],
  kurta: ["kurta", "kurti", "ethnic"],
  ethnic: ["ethnic", "kurta", "sari", "lehenga"],
  black: ["black", "charcoal", "midnight"],
  brown: ["brown", "tobacco", "tan", "cognac", "chocolate"],
  white: ["white", "ivory", "cream"],
  blue: ["blue", "navy", "denim"],
  grey: ["grey", "gray", "slate"],
  green: ["green", "olive", "sage"],
  red: ["red", "burgundy", "maroon"],
  linen: ["linen", "flax"],
  cotton: ["cotton"],
  formal: ["formal", "tailored", "business"],
  casual: ["casual", "relaxed", "everyday"],
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2)
    .slice(0, 8);
}

function singularize(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("ses")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function aliasesFor(token: string): string[] {
  const normalized = singularize(token);
  return [...new Set([token, normalized, ...(QUERY_ALIASES[normalized] ?? []), ...(QUERY_ALIASES[token] ?? [])])];
}

function wordMatches(haystack: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegex(term)}`, "i").test(haystack);
}

function matchesQuery(entry: CatalogEntry, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  return tokens.some((token) =>
    aliasesFor(token).some((alias) => wordMatches(entry.searchText, alias)),
  );
}

function queryRank(entry: CatalogEntry, tokens: string[]): { score: number; exact: boolean } {
  if (tokens.length === 0) return { score: 0, exact: true };
  let matched = 0;
  let score = 0;
  for (const token of tokens) {
    const aliases = aliasesFor(token);
    const direct = aliases.some((alias) => wordMatches(entry.searchText, alias));
    if (!direct) continue;
    matched += 1;
    score += token === aliases[0] ? 3 : 2;
  }
  return { score, exact: matched === tokens.length };
}

function toProduct(
  entry: CatalogEntry,
  rate: Rate,
  verifiedAt: string,
  matchType: "exact" | "similar",
): Product {
  const price = Math.round(entry.usdPrice * rate.rate);
  const originalPrice =
    entry.usdOriginalPrice && entry.usdOriginalPrice > entry.usdPrice
      ? Math.round(entry.usdOriginalPrice * rate.rate)
      : null;
  const discountPercent =
    originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : null;

  return {
    id: entry.id,
    title: entry.title,
    brand: entry.brand,
    imageUrl: entry.imageUrl,
    price,
    originalPrice,
    currency: "INR",
    discountPercent,
    rating: entry.rating,
    reviewCount: entry.reviewCount,
    store: "Livostyle",
    deliveryEstimateDays: null,
    buyUrl: entry.buyUrl,
    category: entry.category,
    audience: "women",
    styleTags: entry.styleTags,
    colors: entry.colors,
    sizes: entry.sizes,
    inStock: entry.inStock,
    sourcePrice: { amount: entry.usdPrice, currency: "USD" },
    priceConverted: true,
    sourceLabel: SOURCE_LABEL,
    productIdentifier: entry.id.replace(/^livostyle-/, ""),
    priceVerifiedAt: verifiedAt,
    matchType,
  };
}

export class LivostyleFeedProvider implements ShoppingProviderPort {
  readonly isConfigured = true;
  readonly demoMode = false;
  readonly id = "livostyle";
  readonly label = SOURCE_LABEL;
  readonly requiresCredentials = false;
  readonly supportsPinCode = false;
  readonly supportedAudiences = ["women"] as const;

  get connectionState(): ShoppingProviderState {
    if (this.lastSuccessAt && (!this.lastErrorAt || this.lastSuccessAt > this.lastErrorAt)) {
      return "connected";
    }
    if (this.lastErrorAt) return "temporarily_unavailable";
    return "verification_pending";
  }

  private lastSuccessAt: string | null = null;
  private lastErrorAt: string | null = null;
  private lastError: string | null = null;

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
    if (input.audience && input.audience !== "women" && input.audience !== "all") {
      return {
        products: [],
        total: 0,
        page: input.page ?? 1,
        totalPages: 0,
        source: "api",
        providerId: this.id,
        providerLabel: this.label,
        checkedAt: new Date().toISOString(),
        pinCodeSupported: false,
        pinCode: input.pinCode ?? null,
        notice:
          "The connected Livostyle catalog is women-only; men's and unisex searches need an approved men-capable provider.",
      };
    }
    try {
      const [entries, rate] = await Promise.all([loadCatalog(), getUsdToInrRate()]);
      const tokens = queryTokens(input.query);
      const filtered = entries.filter(
        (entry) =>
          matchesQuery(entry, tokens) &&
          matchesCategory(entry, input.category) &&
          matchesStyle(entry, input.style) &&
          Math.round(entry.usdPrice * rate.rate) >= (input.minPrice ?? 0) &&
          (input.maxPrice === undefined ||
            Math.round(entry.usdPrice * rate.rate) <= input.maxPrice),
      );

      const ranked = filtered.map((entry) => ({ entry, ...queryRank(entry, tokens) }));
      const sorted = ranked.map((item) => item.entry);
      const scoreByEntry = new Map(ranked.map((item) => [item.entry.id, item]));
      switch (input.sortBy) {
        case "price_asc":
          sorted.sort((a, b) => a.usdPrice - b.usdPrice);
          break;
        case "price_desc":
          sorted.sort((a, b) => b.usdPrice - a.usdPrice);
          break;
        case "rating":
          sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
          break;
        case "discount":
          sorted.sort(
            (a, b) =>
              (b.usdOriginalPrice && b.usdOriginalPrice > b.usdPrice
                ? b.usdOriginalPrice / b.usdPrice
                : 1) -
              (a.usdOriginalPrice && a.usdOriginalPrice > a.usdPrice
                ? a.usdOriginalPrice / a.usdPrice
                : 1),
          );
          break;
        default:
          sorted.sort((a, b) => {
            const left = scoreByEntry.get(a.id);
            const right = scoreByEntry.get(b.id);
            if (!left || !right) return 0;
            if (left.exact !== right.exact) return left.exact ? -1 : 1;
            return right.score - left.score || a.usdPrice - b.usdPrice;
          });
      }

      const page = input.page ?? 1;
      const limit = input.limit ?? 12;
      const start = (page - 1) * limit;
      const verifiedAt = cached?.verifiedAt ?? new Date().toISOString();
      const products = sorted
        .slice(start, start + limit)
        .map((entry) =>
          toProduct(entry, rate, verifiedAt, scoreByEntry.get(entry.id)?.exact ? "exact" : "similar"),
        );
      const checkedAt = new Date().toISOString();
      this.lastSuccessAt = checkedAt;
      this.lastError = null;

      return {
        products,
        total: sorted.length,
        page,
        totalPages: limit > 0 ? Math.ceil(sorted.length / limit) : 0,
        source: "api",
        fx: rate,
        providerId: this.id,
        providerLabel: this.label,
        checkedAt,
        pinCodeSupported: false,
        pinCode: input.pinCode ?? null,
      };
    } catch (error) {
      this.lastErrorAt = new Date().toISOString();
      this.lastError =
        error instanceof Error ? error.message : "Live catalog search failed";
      throw error;
    }
  }

  async getById(id: string): Promise<Product | null> {
    const [entries, rate] = await Promise.all([loadCatalog(), getUsdToInrRate()]);
    const entry = entries.find((candidate) => candidate.id === id);
    return entry
      ? toProduct(entry, rate, cached?.verifiedAt ?? new Date().toISOString(), "exact")
      : null;
  }
}

export function resetLivostyleFeedCache(): void {
  cached = null;
  inFlight = null;
}

export const LIVOSTYLE_CATALOG_URL = FEED_URL;
export const LIVOSTYLE_SOURCE_LABEL = SOURCE_LABEL;
