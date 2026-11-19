"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/products/ProductCard";
import { apiClient } from "@/lib/api";
import {
  buildProductSearchApiParams,
  buildProductSearchHref,
  getAudienceProviderNotice,
  parseProductSearchParams,
  productSearchContextKey,
  type ProductSearchState,
} from "@/lib/product-search";
import {
  API_ENDPOINTS,
  BUILD_LOOK_BUDGETS,
  type BuildLookBudget,
  type Product,
  type ShopAudience,
  type ShoppingProviderStatus,
} from "@stylaiize/shared";

const CATEGORIES = [
  { value: "all", label: "All categories" },
  { value: "upperwear", label: "Upperwear" },
  { value: "lowerwear", label: "Lowerwear" },
  { value: "footwear", label: "Footwear" },
  { value: "accessories", label: "Accessories" },
  { value: "dresses", label: "Dresses" },
  { value: "ethnic", label: "Ethnic" },
  { value: "outerwear", label: "Outerwear" },
];

const QUICK_PICKS = ["linen shirt", "black shirt", "trousers", "loafers", "kurta", "sneakers"];

interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  demoMode?: boolean;
  notice?: string | null;
  providers?: ShoppingProviderStatus;
  providerLabel?: string | null;
}

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();
  const state = useMemo(
    () => parseProductSearchParams(new URLSearchParams(paramsKey)),
    [paramsKey],
  );

  const [searchInput, setSearchInput] = useState(state.query);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [providers, setProviders] = useState<ShoppingProviderStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const contextRef = useRef<string | null>(null);

  const doSearch = useCallback(async (next: ProductSearchState) => {
    const requestId = ++requestIdRef.current;
    const contextKey = productSearchContextKey(next);
    contextRef.current = contextKey;
    const isCurrent = () => requestIdRef.current === requestId && contextRef.current === contextKey;

    setIsLoading(true);
    setError(null);
    setProducts([]);
    setNotice(null);

    try {
      const response = await apiClient.get<ProductsResponse>(
        `${API_ENDPOINTS.products}?${buildProductSearchApiParams(next).toString()}`,
      );
      if (!isCurrent()) return;
      setProducts(response.products ?? []);
      setTotal(response.total ?? 0);
      setTotalPages(response.totalPages ?? 1);
      setProviders(response.providers ?? null);
      setDemoMode(response.demoMode === true);
      setNotice(
        response.notice ?? getAudienceProviderNotice(response.providers, next.audience),
      );
    } catch (caught) {
      if (!isCurrent()) return;
      setProducts([]);
      setTotal(0);
      setTotalPages(1);
      setProviders(null);
      setDemoMode(false);
      setNotice(null);
      setError(caught instanceof Error ? caught.message : "Failed to search products.");
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const next = parseProductSearchParams(new URLSearchParams(paramsKey));
    setSearchInput(next.query);
    if (!next.query.trim()) {
      requestIdRef.current += 1;
      contextRef.current = null;
      setProducts([]);
      setTotal(0);
      setTotalPages(1);
      setProviders(null);
      setNotice(null);
      setDemoMode(false);
      setError(null);
      setIsLoading(false);
      return;
    }
    void doSearch(next);
  }, [doSearch, paramsKey]);

  const navigate = useCallback(
    (patch: Partial<ProductSearchState>) => {
      router.replace(buildProductSearchHref({ ...state, ...patch }), { scroll: false });
    },
    [router, state],
  );

  const handleSearch = () => {
    const query = searchInput.trim();
    if (!query) {
      setError("Please enter a search query.");
      return;
    }
    navigate({ query, queries: [query], page: 1 });
  };

  const handleQuickPick = (pick: string) => {
    setSearchInput(pick);
    navigate({ query: pick, queries: [pick], page: 1 });
  };

  const audienceNotice = notice ?? getAudienceProviderNotice(providers, state.audience);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-sky-500/10 p-2">
            <ShoppingBag className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Product Search</h1>
            <p className="text-sm text-muted-foreground">
              Verified products only, with direct retailer links.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/build-look">
                <ArrowLeft className="h-4 w-4" />
                Generated outfit
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-6xl space-y-5">
          <section className="glass rounded-2xl p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Product search query"
                  placeholder="Search for shirts, shoes, dresses..."
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSearch();
                  }}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-xs text-muted-foreground">
                Audience
                <select
                  aria-label="Audience"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={state.audience}
                  onChange={(event) =>
                    navigate({ audience: event.target.value as ShopAudience, page: 1 })
                  }
                >
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                  <option value="unisex">Unisex</option>
                  <option value="all">All</option>
                </select>
              </label>

              <label className="space-y-1 text-xs text-muted-foreground">
                Category
                <select
                  aria-label="Category"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={state.category}
                  onChange={(event) => navigate({ category: event.target.value, page: 1 })}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs text-muted-foreground">
                Budget
                <select
                  aria-label="Budget"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={state.budget}
                  onChange={(event) =>
                    navigate({ budget: event.target.value as BuildLookBudget | "", page: 1 })
                  }
                >
                  <option value="">No budget cap</option>
                  {BUILD_LOOK_BUDGETS.map((budget) => (
                    <option key={budget} value={budget}>
                      ₹{budget}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ArrowUpDown className="h-3 w-3" />
                  Sort
                </span>
                <select
                  aria-label="Sort"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={state.sortBy}
                  onChange={(event) => navigate({ sortBy: event.target.value, page: 1 })}
                >
                  <option value="relevance">Relevance</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="rating">Top rated</option>
                  <option value="discount">Biggest discount</option>
                </select>
              </label>
            </div>
          </section>

          {state.queries.length > 0 && (
            <section className="glass rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold capitalize text-foreground">Outfit context</span>
                <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 capitalize text-cyan-100">
                  {state.audience}
                </span>
                {state.budget ? (
                  <span className="rounded-full border border-white/10 px-2.5 py-1">₹{state.budget}</span>
                ) : null}
                {state.occasion ? (
                  <span className="rounded-full border border-white/10 px-2.5 py-1">
                    {state.occasion}
                  </span>
                ) : null}
                {state.style ? (
                  <span className="rounded-full border border-white/10 px-2.5 py-1 capitalize">
                    {state.style}
                  </span>
                ) : null}
                {state.colors.map((color, index) => (
                  <span
                    key={`${color}-${index}`}
                    className="rounded-full border border-white/10 px-2.5 py-1"
                  >
                    {color}
                  </span>
                ))}
              </div>
              {state.queries.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {state.queries.map((query, index) => (
                    <button
                      key={`${query}-${index}`}
                      type="button"
                      onClick={() => navigate({ query, page: 1 })}
                      className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                        query === state.query
                          ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                          : "border-white/10 text-slate-300 hover:text-white"
                      }`}
                    >
                      {query}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          )}

          {!state.query && (
            <section className="flex flex-col items-center py-14 text-center">
              <Search className="h-8 w-8 text-sky-400" />
              <h2 className="mt-4 text-lg font-semibold">Search for fashion products</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Enter a product name or choose a common search.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {QUICK_PICKS.map((pick) => (
                  <button
                    key={pick}
                    type="button"
                    onClick={() => handleQuickPick(pick)}
                    className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    {pick}
                  </button>
                ))}
              </div>
            </section>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {audienceNotice && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-100/80">
              {audienceNotice}
            </div>
          )}

          {demoMode && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-100/80">
              Sample catalog only. Prices and products are demo data, not verified live listings.
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && state.query && !error && products.length === 0 && (
            <div className="py-14 text-center">
              <h2 className="text-lg font-semibold">No products found</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                No verified products found for &quot;{state.query}&quot;.
              </p>
            </div>
          )}

          {!isLoading && products.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {total} result{total === 1 ? "" : "s"} found
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} demoMode={demoMode} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={state.page <= 1}
                    onClick={() => navigate({ page: Math.max(1, state.page - 1) })}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {state.page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={state.page >= totalPages}
                    onClick={() => navigate({ page: Math.min(totalPages, state.page + 1) })}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
