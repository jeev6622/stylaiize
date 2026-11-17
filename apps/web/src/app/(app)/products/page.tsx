"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Star,
  ShoppingCart,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  BarChart3,
  Loader2,
  Truck,
  ExternalLink,
  Bell,
  BellRing,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";
import {
  API_ENDPOINTS,
  type Product,
  type PriceComparison,
  type PriceComparisonEntry,
  type PriceAlert,
} from "@stylaiize/shared";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "dresses", label: "Dresses" },
  { value: "footwear", label: "Footwear" },
  { value: "accessories", label: "Accessories" },
  { value: "ethnic", label: "Ethnic" },
  { value: "outerwear", label: "Outerwear" },
  { value: "bags", label: "Bags" },
];

const QUICK_PICKS = [
  "Shirts",
  "Jeans",
  "Sneakers",
  "Dresses",
  "Watches",
  "Kurta",
  "Handbags",
  "Sunglasses",
];

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return null;
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.3;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < fullStars
              ? "fill-amber-400 text-amber-400"
              : i === fullStars && hasHalf
                ? "fill-amber-400/50 text-amber-400"
                : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

export default function ProductsPage() {
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [demoCatalog, setDemoCatalog] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<PriceComparison | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertProduct, setAlertProduct] = useState<Product | null>(null);
  const [alertTarget, setAlertTarget] = useState("");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertSaving, setAlertSaving] = useState(false);
  const [checkingAlerts, setCheckingAlerts] = useState(false);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await apiClient.get<{ alerts: PriceAlert[] }>(API_ENDPOINTS.alerts);
      setAlerts(res.alerts);
    } catch {
      toast.error("Failed to load your price alerts.");
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  function openAlertDialog(product: Product | null) {
    setAlertProduct(product);
    setAlertTarget(product ? String(Math.round(product.price * 0.9)) : "");
    setAlertsOpen(true);
    void loadAlerts();
  }

  async function handleCreateAlert() {
    if (!alertProduct) return;
    const target = Number(alertTarget);
    if (!Number.isFinite(target) || target <= 0) {
      toast.error("Enter a valid target price.");
      return;
    }
    setAlertSaving(true);
    try {
      await apiClient.post(API_ENDPOINTS.alerts, {
        productId: alertProduct.id,
        targetPrice: target,
        conditions: ["price_drop"],
        channels: ["email"],
      });
      toast.success("Price alert created. We'll notify you when the price drops.");
      void loadAlerts();
    } catch {
      toast.error("Failed to create price alert.");
    } finally {
      setAlertSaving(false);
    }
  }

  async function handleDeleteAlert(id: string) {
    try {
      await apiClient.delete(`${API_ENDPOINTS.alerts}/${id}`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.success("Alert removed.");
    } catch {
      toast.error("Failed to remove alert.");
    }
  }

  async function handleCheckAlerts() {
    setCheckingAlerts(true);
    try {
      const res = await apiClient.post<{ triggered: PriceAlert[] }>(`${API_ENDPOINTS.alerts}/check`);
      if (res.triggered.length > 0) {
        toast.success(`${res.triggered.length} alert${res.triggered.length !== 1 ? "s" : ""} triggered!`);
      } else {
        toast.info("No alerts triggered right now.");
      }
      void loadAlerts();
    } catch {
      toast.error("Failed to check alerts.");
    } finally {
      setCheckingAlerts(false);
    }
  }

  function alertProductTitle(id: string): string {
    return products.find((p) => p.id === id)?.title ?? "Product";
  }

  const doSearch = useCallback(
    async (q: string, p: number) => {
      if (!q.trim()) return;
      setIsLoading(true);
      setHasSearched(true);
      try {
        const params = new URLSearchParams({
          query: q.trim(),
          page: String(p),
          limit: "12",
        });
        if (category !== "all") params.set("category", category);
        if (minPrice) params.set("minPrice", minPrice);
        if (maxPrice) params.set("maxPrice", maxPrice);
        if (sortBy) params.set("sortBy", sortBy);

        const res = await apiClient.get<{
          products: Product[];
          total: number;
          page: number;
          totalPages: number;
          demoMode?: boolean;
        }>(`${API_ENDPOINTS.products}?${params.toString()}`);

        setProducts(res.products);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setDemoCatalog(res.demoMode === true);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Failed to search products.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [category, minPrice, maxPrice, sortBy],
  );

  function handleSearch() {
    if (!searchInput.trim()) {
      toast.error("Please enter a search query.");
      return;
    }
    setQuery(searchInput);
    setPage(1);
    void doSearch(searchInput, 1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  function handleQuickPick(pick: string) {
    setSearchInput(pick);
    setQuery(pick);
    setPage(1);
    void doSearch(pick, 1);
  }

  // Support deep links like /products?q=kurta from other pages (e.g. Shop
  // an item from a saved outfit).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q?.trim()) {
      const first = q.trim();
      setSearchInput(first);
      setQuery(first);
      setPage(1);
      void doSearch(first, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (query) {
      void doSearch(query, page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, minPrice, maxPrice, sortBy, page]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) {
        toast.info("Maximum 5 products for comparison.");
        return prev;
      }
      return [...prev, id];
    });
  }

  async function handleCompare() {
    if (selectedIds.length < 2) {
      toast.error("Select at least 2 products to compare.");
      return;
    }
    setIsComparing(true);
    setCompareOpen(true);
    try {
      const res = await apiClient.post<PriceComparison>(
        `${API_ENDPOINTS.products}/compare`,
        { productIds: selectedIds },
      );
      setComparison(res);
    } catch {
      toast.error("Failed to compare products.");
      setCompareOpen(false);
    } finally {
      setIsComparing(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-500/10 p-2">
            <ShoppingCart className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Product Search</h1>
            <p className="text-sm text-muted-foreground">
              Find the best deals on fashion
            </p>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => openAlertDialog(null)}
            >
              <Bell className="h-4 w-4" />
              Price Alerts
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-6xl space-y-5">
          {/* Search Bar */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.3 }}
            className="glass rounded-2xl p-4"
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search for shirts, shoes, dresses..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>

            {/* Filters */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  placeholder="Min ₹"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-[90px]"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="Max ₹"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-[90px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <Select
                  value={sortBy}
                  onValueChange={(v) => {
                    setSortBy(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="price_asc">Price: Low → High</SelectItem>
                    <SelectItem value="price_desc">
                      Price: High → Low
                    </SelectItem>
                    <SelectItem value="rating">Top Rated</SelectItem>
                    <SelectItem value="discount">Biggest Discount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>

          {/* Empty state – before any search */}
          {!hasSearched && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-16 text-center"
            >
              <div className="mb-4 rounded-full bg-sky-500/10 p-4">
                <Search className="h-8 w-8 text-sky-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Search for fashion products
              </h3>
              <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                Discover the best deals across top Indian brands and stores
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_PICKS.map((pick) => (
                  <button
                    key={pick}
                    onClick={() => handleQuickPick(pick)}
                    className="rounded-full border border-border bg-card/50 px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {pick}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* No results */}
          {hasSearched && !isLoading && products.length === 0 && (
            <motion.div
              {...fadeUp}
              className="flex flex-col items-center py-16 text-center"
            >
              <div className="mb-4 rounded-full bg-muted p-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">No products found</h3>
              <p className="text-sm text-muted-foreground">
                No results for &quot;{query}&quot;. Try a different search or
                adjust filters.
              </p>
            </motion.div>
          )}

          {/* Results grid */}
          {!isLoading && products.length > 0 && (
            <>
              {demoCatalog && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Sample catalog.
                    </span>{" "}
                    Live store search is not configured on the server, so these
                    products and prices are demo data, not real listings. An
                    admin can set{" "}
                    <code className="rounded bg-muted px-1">SHOPPING_ENABLED</code>
                    ,{" "}
                    <code className="rounded bg-muted px-1">
                      SHOPPING_API_URL
                    </code>{" "}
                    and{" "}
                    <code className="rounded bg-muted px-1">
                      SHOPPING_API_KEY
                    </code>{" "}
                    in the API{" "}
                    <code className="rounded bg-muted px-1">.env</code> to search
                    live stores.
                  </p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {total} result{total !== 1 ? "s" : ""} found
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => {
                  const isSelected = selectedIds.includes(product.id);
                  return (
                    <motion.div
                      key={product.id}
                      {...fadeUp}
                      className={cn(
                        "glass glass-hover group relative overflow-hidden rounded-2xl p-4 transition-all",
                        isSelected && "border-primary/50 ring-1 ring-primary/30",
                      )}
                    >
                      {/* Product image */}
                      <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-xl bg-secondary/50">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
                        )}
                      </div>

                      {/* Title + brand */}
                      <h3 className="truncate text-sm font-semibold">
                        {product.title}
                      </h3>
                      {product.brand && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {product.brand}
                        </p>
                      )}

                      {/* Price */}
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-lg font-bold text-foreground">
                          {formatCurrency(product.price)}
                        </span>
                        {product.originalPrice && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatCurrency(product.originalPrice)}
                          </span>
                        )}
                        {product.discountPercent && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] text-emerald-400"
                          >
                            {product.discountPercent}% off
                          </Badge>
                        )}
                      </div>

                      {/* Rating */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <StarRating rating={product.rating} />
                        {product.rating !== null && (
                          <span className="text-xs text-muted-foreground">
                            {product.rating}
                          </span>
                        )}
                        {product.reviewCount !== null && (
                          <span className="text-xs text-muted-foreground">
                            ({product.reviewCount.toLocaleString()})
                          </span>
                        )}
                      </div>

                      {/* Store + delivery */}
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {product.store}
                        </Badge>
                        {product.deliveryEstimateDays && (
                          <span className="flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            {product.deliveryEstimateDays.min}–
                            {product.deliveryEstimateDays.max} days
                          </span>
                        )}
                      </div>

                      {/* Colors */}
                      {product.colors.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {product.colors.map((c) => (
                            <span
                              key={c}
                              className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}

                      <Separator className="my-3" />

                      {/* Actions */}
                      <div className="flex items-center justify-between">
                        <label className="flex cursor-pointer items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(product.id)}
                            className="accent-primary"
                          />
                          Compare
                        </label>

                        <div className="flex items-center gap-2">
                          {!product.inStock && (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              Out of stock
                            </Badge>
                          )}
                          {product.inStock && (
                            <a
                              href={product.buyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                            >
                              Visit Store
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <button
                            onClick={() => openAlertDialog(product)}
                            className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                            title="Set price alert"
                          >
                            <Bell className="h-3 w-3" />
                            Set Alert
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const p = i + 1;
                    const show =
                      p === 1 || p === totalPages || Math.abs(p - page) <= 1;
                    if (!show) {
                      if (p === page - 2 || p === page + 2)
                        return (
                          <span
                            key={p}
                            className="px-1 text-muted-foreground"
                          >
                            …
                          </span>
                        );
                      return null;
                    }
                    return (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    );
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Compare Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 px-6 py-3 backdrop-blur-md"
          >
            <div className="mx-auto flex max-w-6xl items-center justify-between">
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {selectedIds.length}
                </span>{" "}
                product{selectedIds.length !== 1 ? "s" : ""} selected
                {selectedIds.length < 2 && " (select at least 2)"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Clear
                </Button>
                <Button
                  size="sm"
                  disabled={selectedIds.length < 2 || isComparing}
                  onClick={() => void handleCompare()}
                >
                  {isComparing ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <BarChart3 className="mr-1 h-3.5 w-3.5" />
                  )}
                  Compare Now
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Price Alerts Dialog */}
      <Dialog
        open={alertsOpen}
        onOpenChange={(open) => {
          setAlertsOpen(open);
          if (!open) setAlertProduct(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Price Alerts
            </DialogTitle>
            <DialogDescription>
              Get notified when a product drops below your target price.
            </DialogDescription>
          </DialogHeader>

          {alertProduct && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-sm font-medium">{alertProduct.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Current price: <span className="font-semibold text-foreground">{formatCurrency(alertProduct.price)}</span>
              </p>
              <div className="mt-3 flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Notify me below</label>
                  <Input
                    type="number"
                    min={1}
                    value={alertTarget}
                    onChange={(e) => setAlertTarget(e.target.value)}
                    placeholder="Target price (₹)"
                  />
                </div>
                <Button onClick={() => void handleCreateAlert()} disabled={alertSaving} className="gap-2">
                  {alertSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                  Create
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Your alerts</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void handleCheckAlerts()}
                disabled={checkingAlerts}
              >
                {checkingAlerts ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BellRing className="h-3.5 w-3.5" />
                )}
                Check prices
              </Button>
            </div>
          </div>

          {alertsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No price alerts yet. Pick a product and set a target price.
            </p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-secondary/30 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {alertProductTitle(alert.productId)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {alert.targetPrice ? `Below ${formatCurrency(alert.targetPrice)}` : "Any price"} ·{" "}
                      <span className={alert.status === "triggered" ? "text-emerald-400" : "capitalize"}>
                        {alert.status}
                      </span>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => void handleDeleteAlert(alert.id)}
                    title="Delete alert"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Comparison Dialog */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Price Comparison</DialogTitle>
            <DialogDescription>
              Comparing {comparison?.entries.length ?? 0} products side by side
            </DialogDescription>
          </DialogHeader>

          {isComparing && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isComparing && comparison && comparison.entries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-muted-foreground">
                      Attribute
                    </th>
                    {comparison.entries.map((e) => (
                      <th
                        key={e.product.id}
                        className="px-3 py-2 text-left font-medium"
                      >
                        <div className="max-w-[180px] truncate">
                          {e.product.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {e.product.brand}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow
                    label="Price"
                    entries={comparison.entries}
                    render={(e) => (
                      <span
                        className={cn(
                          "font-semibold",
                          e.isLowestPrice && "text-emerald-400",
                        )}
                      >
                        {formatCurrency(e.product.price)}
                        {e.isLowestPrice && (
                          <Badge
                            variant="secondary"
                            className="ml-1 text-[10px] text-emerald-400"
                          >
                            Lowest
                          </Badge>
                        )}
                      </span>
                    )}
                  />
                  {comparison.entries.some(
                    (e) => e.product.originalPrice,
                  ) && (
                    <CompareRow
                      label="Original Price"
                      entries={comparison.entries}
                      render={(e) =>
                        e.product.originalPrice ? (
                          <span className="text-muted-foreground line-through">
                            {formatCurrency(e.product.originalPrice)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )
                      }
                    />
                  )}
                  <CompareRow
                    label="Discount"
                    entries={comparison.entries}
                    render={(e) =>
                      e.product.discountPercent ? (
                        <span className="text-emerald-400">
                          {e.product.discountPercent}% off
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
                    }
                  />
                  <CompareRow
                    label="Rating"
                    entries={comparison.entries}
                    render={(e) => (
                      <span
                        className={cn(
                          e.isHighestRated && "text-amber-400",
                        )}
                      >
                        {e.product.rating ?? "—"} ★
                        {e.isHighestRated && (
                          <Badge
                            variant="secondary"
                            className="ml-1 text-[10px] text-amber-400"
                          >
                            Best
                          </Badge>
                        )}
                      </span>
                    )}
                  />
                  <CompareRow
                    label="Reviews"
                    entries={comparison.entries}
                    render={(e) =>
                      e.product.reviewCount?.toLocaleString() ?? "—"
                    }
                  />
                  <CompareRow
                    label="Store"
                    entries={comparison.entries}
                    render={(e) => (
                      <Badge variant="outline">{e.product.store}</Badge>
                    )}
                  />
                  <CompareRow
                    label="Delivery"
                    entries={comparison.entries}
                    render={(e) =>
                      e.product.deliveryEstimateDays
                        ? `${e.product.deliveryEstimateDays.min}–${e.product.deliveryEstimateDays.max} days`
                        : "—"
                    }
                  />
                  <CompareRow
                    label="Colors"
                    entries={comparison.entries}
                    render={(e) => e.product.colors.join(", ") || "—"}
                  />
                  <CompareRow
                    label="Sizes"
                    entries={comparison.entries}
                    render={(e) => e.product.sizes.join(", ") || "—"}
                  />
                  <CompareRow
                    label="In Stock"
                    entries={comparison.entries}
                    render={(e) =>
                      e.product.inStock ? (
                        <span className="text-emerald-400">Yes</span>
                      ) : (
                        <span className="text-destructive">No</span>
                      )
                    }
                  />
                  <CompareRow
                    label="Best Value"
                    entries={comparison.entries}
                    render={(e) =>
                      e.isBestValue ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] text-emerald-400"
                        >
                          Best Value
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
                    }
                  />
                </tbody>
              </table>
            </div>
          )}

          {!isComparing && comparison && comparison.entries.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              No products to compare.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompareRow({
  label,
  entries,
  render,
}: {
  label: string;
  entries: PriceComparisonEntry[];
  render: (entry: PriceComparisonEntry) => React.ReactNode;
}) {
  return (
    <tr className="border-b border-border/50">
      <td className="px-3 py-2 text-muted-foreground">{label}</td>
      {entries.map((e) => (
        <td key={e.product.id} className="px-3 py-2">
          {render(e)}
        </td>
      ))}
    </tr>
  );
}
