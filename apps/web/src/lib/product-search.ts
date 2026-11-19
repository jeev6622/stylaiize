import {
  BUILD_LOOK_BUDGETS,
  SHOP_AUDIENCES,
  noVerifiedProductsMessage,
  type BuildLookBudget,
  type ShopAudience,
  type ShoppingProviderStatus,
} from "@stylaiize/shared";
const VALID_SORTS = new Set([
  "relevance",
  "price_asc",
  "price_desc",
  "rating",
  "discount",
]);

export interface ProductSearchState {
  query: string;
  audience: ShopAudience;
  category: string;
  budget: BuildLookBudget | "";
  occasion: string;
  style: string;
  queries: string[];
  categories: string[];
  colors: string[];
  minPrice: string;
  maxPrice: string;
  sortBy: string;
  page: number;
}

export const EMPTY_PRODUCT_SEARCH_STATE: ProductSearchState = {
  query: "",
  audience: "all",
  category: "all",
  budget: "",
  occasion: "",
  style: "",
  queries: [],
  categories: [],
  colors: [],
  minPrice: "",
  maxPrice: "",
  sortBy: "relevance",
  page: 1,
};

function readStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim().slice(0, 200))
      .slice(0, 10);
  } catch {
    return [];
  }
}

function validAudience(value: string | null): ShopAudience {
  return SHOP_AUDIENCES.find((audience) => audience === value) ?? "all";
}

function validBudget(value: string | null): BuildLookBudget | "" {
  return BUILD_LOOK_BUDGETS.find((budget) => budget === value) ?? "";
}

function validPage(value: string | null): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function parseProductSearchParams(params: URLSearchParams): ProductSearchState {
  const query = params.get("q") ?? params.get("query") ?? params.get("focus") ?? "";
  const queries = readStringArray(params.get("queries"));
  return {
    query: query.trim().slice(0, 200),
    audience: validAudience(params.get("audience")),
    category: params.get("category")?.trim().slice(0, 60) || "all",
    budget: validBudget(params.get("budget")),
    occasion: params.get("occasion")?.trim().slice(0, 160) ?? "",
    style: params.get("style")?.trim().slice(0, 80) ?? "",
    queries: queries.length > 0 ? queries : query.trim() ? [query.trim()] : [],
    categories: readStringArray(params.get("categories")),
    colors: readStringArray(params.get("colors")),
    minPrice: params.get("minPrice")?.trim() ?? "",
    maxPrice: params.get("maxPrice")?.trim() ?? "",
    sortBy: VALID_SORTS.has(params.get("sortBy") ?? "")
      ? (params.get("sortBy") as string)
      : "relevance",
    page: validPage(params.get("page")),
  };
}

export function buildProductSearchHref(patch: Partial<ProductSearchState>): string {
  const state: ProductSearchState = { ...EMPTY_PRODUCT_SEARCH_STATE, ...patch };
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.audience !== "all") params.set("audience", state.audience);
  if (state.category !== "all") params.set("category", state.category);
  if (state.budget) params.set("budget", state.budget);
  if (state.occasion) params.set("occasion", state.occasion);
  if (state.style) params.set("style", state.style);
  if (state.queries.length > 0) params.set("queries", JSON.stringify(state.queries));
  if (state.categories.length > 0) params.set("categories", JSON.stringify(state.categories));
  if (state.colors.length > 0) params.set("colors", JSON.stringify(state.colors));
  if (state.minPrice) params.set("minPrice", state.minPrice);
  if (state.maxPrice) params.set("maxPrice", state.maxPrice);
  if (state.sortBy !== "relevance") params.set("sortBy", state.sortBy);
  if (state.page > 1) params.set("page", String(state.page));
  const search = params.toString();
  return search ? `/products?${search}` : "/products";
}

export function budgetToMaxPrice(budget: BuildLookBudget | ""): string {
  if (budget === "2000") return "2000";
  if (budget === "5000") return "5000";
  if (budget === "10000") return "10000";
  return "";
}

export function buildProductSearchApiParams(state: ProductSearchState): URLSearchParams {
  const params = new URLSearchParams({
    query: state.query.trim(),
    page: String(state.page),
    limit: "12",
    audience: state.audience,
  });
  if (state.category !== "all") params.set("category", state.category);
  const maxPrice = state.maxPrice || budgetToMaxPrice(state.budget);
  if (state.minPrice) params.set("minPrice", state.minPrice);
  if (maxPrice) params.set("maxPrice", maxPrice);
  if (state.sortBy) params.set("sortBy", state.sortBy);
  if (state.style) params.set("style", state.style);
  return params;
}

export function productSearchContextKey(state: ProductSearchState): string {
  return JSON.stringify({
    query: state.query.trim(),
    audience: state.audience,
    category: state.category,
    occasion: state.occasion,
    style: state.style,
    queries: state.queries,
    categories: state.categories,
    colors: state.colors,
    budget: state.budget,
    minPrice: state.minPrice,
    maxPrice: state.maxPrice,
    sortBy: state.sortBy,
    page: state.page,
  });
}

export function getAudienceProviderNotice(
  providers: ShoppingProviderStatus | null | undefined,
  audience: ShopAudience,
): string | null {
  if (!audience || audience === "all") return null;
  const capable = providers?.providers.some((provider) => {
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
  return noVerifiedProductsMessage(audience);
}

interface BuildLookSearchSource {
  look: {
    eventName: string;
    styleName?: string;
    shoppingQueries?: string[] | null;
    items: Array<{ name: string; category: string }>;
  };
  audience: ShopAudience;
  budget: BuildLookBudget | "";
  occasion?: string;
  style?: string;
  queries?: string[] | null;
  colors?: string[] | null;
}

export function buildLookProductSearchContext(source: BuildLookSearchSource): ProductSearchState {
  const sourceQueries = source.queries?.length ? source.queries : source.look.shoppingQueries ?? [];
  const queries = sourceQueries
    .map((query) => query.trim())
    .filter(Boolean)
    .slice(0, 10);
  const categories = [...new Set(source.look.items.map((item) => item.category).filter(Boolean))];
  const query = queries[0] ?? source.look.items[0]?.name ?? `${source.look.styleName ?? ""} ${source.look.eventName}`.trim();
  return {
    ...EMPTY_PRODUCT_SEARCH_STATE,
    query: query.trim().slice(0, 200),
    audience: source.audience,
    category: categories[0] ?? "all",
    budget: source.budget,
    occasion: source.occasion?.trim() || source.look.eventName,
    style: source.style?.trim() || source.look.styleName || "",
    queries,
    categories,
    colors: (source.colors ?? []).map((color) => color.trim()).filter(Boolean).slice(0, 12),
  };
}
