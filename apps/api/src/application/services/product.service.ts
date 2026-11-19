import type {
  BuildLookBudget,
  BuildLookBudgetSummary,
  BuildLookShopItemInput,
  BuildLookShopMatch,
  BuildLookShopResult,
  PriceComparison,
  Product,
  ShopAudience,
  ShopStyleTag,
  ShoppingProviderStatus,
} from "@stylaiize/shared";
import { noApprovedShoppingProviderMessage } from "@stylaiize/shared";
import { AppError } from "@/utils/errors";
import {
  resolveShoppingProvider,
  shoppingProviderStatus,
} from "@/infrastructure/shopping/factory";
import { ShoppingUnavailableError } from "@/infrastructure/shopping/errors";
import { inferStyleTags } from "@/infrastructure/shopping/catalog-attributes";
import type { ShoppingSearchResult } from "@/infrastructure/shopping/shopping.interface";
import { findSimilarAlternatives } from "./product-matching.service";
import { buildProductComparison, compareProductList } from "./price-comparison.service";
import { validateAvailability } from "./availability.service";
import { calculateBuildLookBudget } from "./budget.service";

export interface SearchInput {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "relevance" | "price_asc" | "price_desc" | "rating" | "discount";
  page?: number;
  limit?: number;
  pinCode?: string;
  audience?: ShopAudience;
  style?: string;
}

export interface ShopBuildLookOptions {
  audience?: ShopAudience;
  occasion?: string;
  style?: string;
  budget?: BuildLookBudget;
  pinCode?: string | null;
}

const SHOP_CATEGORY_HINTS: Record<string, string> = {
  upperwear: "shirt",
  lowerwear: "tailored trousers",
  footwear: "formal shoes",
  accessories: "accessories",
  tops: "shirt",
  bottoms: "tailored trousers",
  dresses: "dress",
  ethnic: "ethnic wear",
  outerwear: "blazer",
  bags: "bag",
};

function httpsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function directProductUrl(value: string | null | undefined): boolean {
  if (!httpsUrl(value)) return false;
  const parsed = new URL(value as string);
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return false;
  if (segments.some((segment) => /^(s|search|searches|results?|browse)$/i.test(segment))) {
    return false;
  }
  return !["q", "k", "query", "text", "keyword"].some((key) => parsed.searchParams.has(key));
}

function verifiedProductCandidate(product: Product): boolean {
  return (
    Boolean(product.imageUrl) &&
    httpsUrl(product.imageUrl) &&
    directProductUrl(product.buyUrl) &&
    product.currency === "INR" &&
    Boolean(product.priceVerifiedAt) &&
    product.price > 0
  );
}

function productDedupeKey(product: Product): string {
  try {
    const parsed = new URL(product.buyUrl);
    return `url:${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return `product:${product.store}|${product.title}|${product.brand ?? ""}`;
  }
}

function deriveAudience(item: BuildLookShopItemInput): ShopAudience | undefined {
  if (item.audience) return item.audience;
  const gender = (item.gender ?? "").toLowerCase();
  if (/unisex/.test(gender)) return "unisex";
  if (/women|woman|female|girl|ladies/.test(gender)) return "women";
  if (/men|man|male|boy/.test(gender)) return "men";
  return undefined;
}

function deriveStyles(item: BuildLookShopItemInput): ShopStyleTag[] {
  if (item.style === "traditional") return ["traditional", "ethnic"];
  if (item.style === "classic" || item.style === "luxury") return ["formal"];
  if (item.style === "modern") return ["western"];
  if (item.style === "minimal" || item.style === "streetwear") return ["casual"];
  return inferStyleTags(`${item.name} ${item.category}`);
}

type ItemIntent =
  | "shirt"
  | "trousers"
  | "formal_shoes"
  | "shoes"
  | "belt"
  | "watch"
  | "dress"
  | "skirt"
  | "blazer"
  | "ethnic"
  | "bag";

function itemIntent(item: BuildLookShopItemInput): ItemIntent | null {
  const text = `${item.name} ${item.category} ${item.query ?? ""}`.toLowerCase();
  if (/\bbelt\b/.test(text)) return "belt";
  if (/\b(watch|timepiece|smartwatch)\b/.test(text)) return "watch";
  if (/\b(bag|handbag|backpack|tote)\b/.test(text)) return "bag";
  if (/\b(shirt|t-shirt|tshirt|tee|blouse|button[-\s]?down|top)\b/.test(text)) return "shirt";
  if (/\b(trouser|pant|chino|jeans|bottom|cargo)\b/.test(text)) return "trousers";
  if (/\b(dress|gown)\b/.test(text)) return "dress";
  if (/\bskirt\b/.test(text)) return "skirt";
  if (/\b(blazer|jacket|coat)\b/.test(text)) return "blazer";
  if (/\b(kurta|sherwani|saree|lehenga|ethnic)\b/.test(text)) return "ethnic";
  if (/\b(loafer|oxford|derby|brogue)\b/.test(text)) return "formal_shoes";
  if (/\b(shoe|footwear|sneaker|boot|sandal|heel|slipper)\b/.test(text)) return "shoes";
  return null;
}

function matchesItemIntent(intent: ItemIntent | null, product: Product): boolean {
  if (!intent) return true;
  const text = `${product.title} ${product.category} ${product.brand ?? ""}`.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(text);
  switch (intent) {
    case "shirt":
      return (
        has(/\b(shirt|t-shirt|tshirt|tee|blouse|button[-\s]?down|top)s?\b/) &&
        !has(/\b(dress|gown|skirt|trouser|pant|bag|handbag)s?\b/)
      );
    case "trousers":
      return (
        has(/\b(trouser|pant|chino|jeans|bottom|cargo)s?\b/) &&
        !has(/\b(skirt|dress|short)s?\b/)
      );
    case "formal_shoes":
      return (
        has(/\b(loafer|oxford|derby|brogue|formal shoes?|dress shoes?|shoe)s?\b/) &&
        !has(/\b(sneaker|sandal|slipper|flip flops?|heel)s?\b/)
      );
    case "shoes":
      return has(/\b(shoe|footwear|sneaker|loafer|boot|sandal|heel|slipper)s?\b/);
    case "belt":
      return has(/\bbelts?\b/) && !has(/\b(watch|timepiece|earring|necklace|jewel|bracelet)s?\b/);
    case "watch":
      return (
        has(/\b(watch|timepiece|smartwatch)s?\b/) &&
        !has(/\b(belt|earring|necklace|jewel|bracelet)s?\b/)
      );
    case "dress":
      return has(/\b(dress|gown)s?\b/);
    case "skirt":
      return has(/\bskirts?\b/);
    case "blazer":
      return has(/\b(blazer|jacket|coat)s?\b/);
    case "ethnic":
      return has(/\b(kurta|sherwani|saree|lehenga|ethnic|salwar)s?\b/);
    case "bag":
      return has(/\b(bag|handbag|backpack|tote)s?\b/);
    default:
      return true;
  }
}

function compatibleProductAudience(
  product: Product,
  audience: ShopAudience | undefined,
): boolean {
  if (!audience || audience === "all") return true;
  const productAudience = product.audience ?? "all";
  if (productAudience === "all") return false;
  if (audience === "unisex") return productAudience === "unisex";
  return productAudience === audience || productAudience === "unisex";
}

function shopQuery(item: BuildLookShopItemInput): { query: string; fallback: string } {
  const fallback = SHOP_CATEGORY_HINTS[item.category.trim().toLowerCase()] ?? "fashion";
  if (item.query?.trim()) {
    return { query: item.query.trim().slice(0, 200), fallback };
  }
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "with",
    "for",
    "in",
    "of",
    "pair",
    "light",
  ]);
  const words = [
    item.brand ?? "",
    item.name,
    item.color ?? "",
    item.size ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .slice(0, 8);
  return { query: words.join(" ") || fallback, fallback };
}

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function productScore(product: Product, tokens: string[], item: BuildLookShopItemInput): number {
  const haystack = [
    product.title,
    product.brand ?? "",
    product.category,
    product.colors.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const matched = tokens.filter((token) => haystack.includes(token)).length;
  const brandBonus =
    item.brand && product.brand && product.brand.toLowerCase().includes(item.brand.toLowerCase())
      ? 15
      : 0;
  const colorBonus =
    item.color &&
    product.colors.some((color) => color.toLowerCase().includes(item.color!.toLowerCase()))
      ? 10
      : 0;
  return matched * 20 + brandBonus + colorBonus + (product.inStock ? 8 : 0);
}

function selectProduct(
  products: Product[],
  tokens: string[],
  item: BuildLookShopItemInput,
  usedProductKeys: Set<string>,
  audience: ShopAudience | undefined,
): Product | null {
  const styles = deriveStyles(item);
  const intent = itemIntent(item);
  const usable = products.filter((product) => {
    if (!verifiedProductCandidate(product)) return false;
    if (!compatibleProductAudience(product, audience)) return false;
    return matchesItemIntent(intent, product);
  });
  const available = usable.filter((product) => !usedProductKeys.has(productDedupeKey(product)));
  if (available.length === 0) return null;
  const styleBonus = (product: Product) =>
    styles.some((tag) => product.styleTags.includes(tag)) ? 10 : 0;
  const exact = available.filter((product) => product.matchType === "exact");
  const pool = exact.length > 0 ? exact : available;
  const selected =
    [...pool].sort(
      (a, b) =>
        productScore(b, tokens, item) +
        styleBonus(b) -
        (productScore(a, tokens, item) + styleBonus(a)) ||
        a.price - b.price,
    )[0] ?? null;
  if (selected) usedProductKeys.add(productDedupeKey(selected));
  return selected;
}

function unsupportedAudienceReason(
  providers: ShoppingProviderStatus,
  audience: ShopAudience | undefined,
): string | null {
  if (!audience || audience === "all") return null;
  const capable = providers.providers.some((provider) => {
    if (
      !provider.connected ||
      provider.state === "not_configured" ||
      provider.state === "approval_required"
    ) {
      return false;
    }
    const supported = provider.supportedAudiences ?? ["men", "women", "unisex", "all"];
    return supported.includes(audience);
  });
  if (capable) return null;
  return noApprovedShoppingProviderMessage(audience);
}

export async function searchProducts(input: SearchInput) {
  const provider = resolveShoppingProvider();
  if (provider.demoMode) throw new ShoppingUnavailableError();
  const result = await provider.search(input);
  const products = result.products.filter(verifiedProductCandidate);
  return {
    ...result,
    products,
    demoMode: false,
    notice:
      products.length < result.products.length
        ? "Listings without a genuine image, direct product link or verified INR price were hidden."
        : result.notice ?? null,
    providers: shoppingProviderStatus(),
  };
}

export async function shopBuildLookItems(
  items: BuildLookShopItemInput[],
  options: ShopBuildLookOptions = {},
): Promise<BuildLookShopResult> {
  const provider = resolveShoppingProvider();
  if (provider.demoMode) throw new ShoppingUnavailableError();
  const pinCode = options.pinCode ?? null;
  const maxPrice =
    options.budget && options.budget !== "premium"
      ? Number.parseInt(options.budget, 10)
      : undefined;

  const matches: BuildLookShopMatch[] = [];
  const usedProductKeys = new Set<string>();
  let fx: BuildLookShopResult["fx"] = null;
  let sourceLabel = "Connected shopping providers";
  let checkedAt = new Date().toISOString();
  let pinCodeSupported = false;
  let lastNotice: string | null = null;

  for (const item of items) {
    const { query, fallback } = shopQuery(item);
    const audience =
      options.audience && options.audience !== "all" ? options.audience : deriveAudience(item);
    const intent = itemIntent(item);
    const style = deriveStyles(item).join(" ");
    try {
      const result: ShoppingSearchResult = await provider.search({
        query,
        category: item.category,
        sortBy: "relevance",
        limit: 20,
        ...(maxPrice !== undefined ? { maxPrice } : {}),
        ...(pinCode ? { pinCode } : {}),
        ...(audience ? { audience } : {}),
        style,
      });
      if (result.fx) fx = result.fx;
      if (result.checkedAt) checkedAt = result.checkedAt;
      if (result.providerLabel) sourceLabel = result.providerLabel;
      if (result.pinCodeSupported) pinCodeSupported = true;
      if (result.notice) lastNotice = result.notice;

      const tokens = queryTokens(query);
      let candidateProducts = result.products;
      let product = selectProduct(result.products, tokens, item, usedProductKeys, audience);

      if (!product && fallback !== query) {
        const fallbackResult = await provider.search({
          query: fallback,
          category: item.category,
          sortBy: "relevance",
          limit: 20,
          ...(maxPrice !== undefined ? { maxPrice } : {}),
          ...(pinCode ? { pinCode } : {}),
          ...(audience ? { audience } : {}),
          style,
        });
        if (fallbackResult.fx) fx = fallbackResult.fx;
        if (fallbackResult.checkedAt) checkedAt = fallbackResult.checkedAt;
        if (fallbackResult.providerLabel) sourceLabel = fallbackResult.providerLabel;
        if (fallbackResult.pinCodeSupported) pinCodeSupported = true;
        if (fallbackResult.notice) lastNotice = fallbackResult.notice;
        candidateProducts = [...candidateProducts, ...fallbackResult.products];
        product = selectProduct(
          fallbackResult.products,
          queryTokens(fallback),
          item,
          usedProductKeys,
          audience,
        );
      }

      const eligibleProducts = [...new Map(
        candidateProducts
          .filter((candidate) => verifiedProductCandidate(candidate))
          .filter((candidate) => compatibleProductAudience(candidate, audience))
          .filter((candidate) => matchesItemIntent(intent, candidate))
          .map((candidate) => [productDedupeKey(candidate), candidate]),
      ).values()];
      const alternatives = product
        ? findSimilarAlternatives(product, eligibleProducts, 12).filter(
            (entry) => !usedProductKeys.has(productDedupeKey(entry.product)),
          )
        : [];
      matches.push({
        itemId: item.itemId,
        itemName: item.name,
        searchQuery: query,
        status: product ? "found" : "no_product",
        reason: product
          ? null
            : unsupportedAudienceReason(shoppingProviderStatus(), audience) ??
            lastNotice ??
            null,
        product,
        alternatives: alternatives.map((entry) => entry.product),
        comparison: product ? buildProductComparison(product, eligibleProducts) : null,
        availability: validateAvailability(product, pinCode, {
          ...result,
          pinCodeSupported,
        }),
      });
    } catch {
      throw new ShoppingUnavailableError();
    }
  }

  const budgetSummary: BuildLookBudgetSummary | null = options.budget
    ? calculateBuildLookBudget(
        options.budget,
        matches.map((match) => ({
          itemId: match.itemId,
          product: match.product,
          alternatives: match.alternatives,
        })),
      )
    : null;

  return {
    matches,
    source: "api",
    sourceLabel,
    fx,
    budget: budgetSummary,
    pinCode,
    providers: shoppingProviderStatus(),
    checkedAt,
  };
}

export async function compareProducts(productIds: string[]): Promise<PriceComparison> {
  const provider = resolveShoppingProvider();
  if (provider.demoMode) {
    throw new AppError(
      422,
      "Price comparison requires genuinely comparable live products. Demo products cannot be compared.",
      { code: "INCOMPARABLE_PRODUCTS" },
    );
  }

  const products: Product[] = [];
  for (const id of productIds) {
    const product = await provider.getById(id);
    if (product && product.currency === "INR") products.push(product);
  }

  if (products.length === 0) {
    throw new AppError(422, "No comparable live products were found for comparison.", {
      code: "INCOMPARABLE_PRODUCTS",
    });
  }

  return compareProductList(products);
}

export async function getProductById(id: string): Promise<Product | null> {
  const provider = resolveShoppingProvider();
  return provider.getById(id);
}

export function getShoppingStatus(): ShoppingProviderStatus {
  return shoppingProviderStatus();
}
