"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Tag,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BuildLookShopMatch,
  BuildLookShopResult,
  Product,
} from "@stylaiize/shared";
import { API_ENDPOINTS } from "@stylaiize/shared";
import { apiClient } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BudgetSelector } from "./BudgetSelector";
import type { BudgetLevel } from "./types";

interface ShoppingStageProps {
  isVisible: boolean;
  isLoading: boolean;
  isSaving: boolean;
  result: BuildLookShopResult | null;
  error: string | null;
  budget: BudgetLevel;
  pinCode: string;
  onPinCodeChange: (pinCode: string) => void;
  onBudgetChange: (budget: BudgetLevel) => void;
  onFind: () => void;
  onSaveOutfit: () => void;
  onSelectionChange: (products: Product[]) => void;
}

function budgetCap(budget: BudgetLevel): string {
  if (budget === "premium") return "No fixed cap";
  return `Total outfit budget up to ₹${Number(budget).toLocaleString("en-IN")}`;
}

function formatCheckedAt(value: string | null | undefined): string {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not reported" : date.toLocaleString("en-IN");
}

function productOptions(match: BuildLookShopMatch): Product[] {
  return [match.product, ...match.alternatives].filter(
    (product): product is Product => product !== null,
  );
}

export function ShoppingStage({
  isVisible,
  isLoading,
  isSaving,
  result,
  error,
  budget,
  pinCode,
  onPinCodeChange,
  onBudgetChange,
  onFind,
  onSaveOutfit,
  onSelectionChange,
}: ShoppingStageProps) {
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, string>>({});
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const loadFavourites = useCallback(async () => {
    try {
      const res = await apiClient.get<{ favourites: Product[] }>(
        API_ENDPOINTS.account.favourites,
      );
      setFavouriteIds(new Set(res.favourites.map((item) => item.id)));
    } catch {
      setFavouriteIds(new Set());
    }
  }, []);

  useEffect(() => {
    if (isVisible && result) void loadFavourites();
  }, [isVisible, result, loadFavourites]);

  useEffect(() => {
    setSelectedIds({});
    setExpandedItem(null);
  }, [result]);

  const selectedProducts = useMemo(() => {
    return (result?.matches ?? [])
      .map((match) => {
        const options = productOptions(match);
        const selectedId = selectedIds[match.itemId];
        return options.find((product) => product.id === selectedId) ?? match.product;
      })
      .filter((product): product is Product => product !== null);
  }, [result, selectedIds]);

  useEffect(() => {
    onSelectionChange(selectedProducts);
  }, [selectedProducts, onSelectionChange]);

  const totals = useMemo(() => {
    const matches = result?.matches ?? [];
    const allFound = selectedProducts.length > 0 && selectedProducts.length === matches.length;
    const inr = selectedProducts.every((product) => product.currency === "INR");
    const verified = selectedProducts.every((product) => Boolean(product.priceVerifiedAt));
    if (!allFound || !inr || !verified) return null;
    return selectedProducts.reduce((sum, product) => sum + product.price, 0);
  }, [result, selectedProducts]);

  const capInr = result?.budget?.capInr ?? (budget === "premium" ? null : Number(budget));
  const remaining = totals !== null && capInr !== null ? capInr - totals : null;

  if (!isVisible) return null;

  async function toggleFavourite(product: Product) {
    setSavingId(product.id);
    const isSaved = favouriteIds.has(product.id);
    try {
      if (isSaved) {
        await apiClient.delete(
          `${API_ENDPOINTS.account.favourites}/${encodeURIComponent(product.id)}`,
        );
        setFavouriteIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
        toast.success("Removed from favourites.");
      } else {
        await apiClient.post(API_ENDPOINTS.account.favourites, { product });
        setFavouriteIds((prev) => new Set(prev).add(product.id));
        toast.success("Saved to favourites.");
      }
    } catch {
      toast.error(isSaved ? "Failed to remove favourite." : "Failed to save favourite.");
    } finally {
      setSavingId(null);
    }
  }

  async function saveAllFavourites() {
    const products = selectedProducts.filter((product) => !favouriteIds.has(product.id));
    if (products.length === 0) {
      toast.success("All selected products are already saved.");
      return;
    }
    setSavingId("all");
    try {
      await Promise.all(
        products.map((product) =>
          apiClient.post(API_ENDPOINTS.account.favourites, { product }),
        ),
      );
      setFavouriteIds((prev) => {
        const next = new Set(prev);
        products.forEach((product) => next.add(product.id));
        return next;
      });
      toast.success(`${products.length} products saved to favourites.`);
    } catch {
      toast.error("Failed to save some favourites.");
    } finally {
      setSavingId(null);
    }
  }

  async function shareOutfit() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "My StylAIze outfit", url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Outfit link copied.");
      } else {
        toast.error("Sharing is not available in this browser.");
      }
    } catch {
      toast.error("Could not share this outfit.");
    }
  }

  return (
    <div className="space-y-5">
      {!result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass space-y-5 rounded-2xl border border-border/50 p-6 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">
              Shop The Complete Look
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Find real, purchasable products for every styling item. Prices, stock and links come
            from connected providers only.
          </p>
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
            <BudgetSelector selected={budget} onSelect={onBudgetChange} />
            <p className="mt-3 text-xs text-muted-foreground">{budgetCap(budget)}</p>
          </div>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              PIN code (optional)
            </span>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={pinCode}
                onChange={(event) => onPinCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="Enter 6-digit PIN code"
                className="w-full rounded-xl border border-border/60 bg-secondary/30 py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
              />
            </div>
            <span className="block text-[11px] text-muted-foreground">
              If a provider cannot check PIN-code availability, the retailer website is shown as the
              place to confirm it.
            </span>
          </label>
          <Button className="w-full gap-2" size="lg" disabled={isLoading} onClick={onFind}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {isLoading ? "Searching connected providers..." : "Find real products for this look"}
          </Button>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </motion.div>
      )}

      {result && (
        <>
          <div className="glass space-y-4 rounded-2xl border border-border/50 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Your Complete Outfit</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={onFind}
                className="gap-1"
              >
                <Search className="h-3 w-3" />
                Refresh
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 text-[10px]">
              {result.providers.providers.map((provider) => (
                <span
                  key={provider.id}
                  className={cn(
                    "rounded-full border px-2 py-1",
                    provider.connected
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : "border-border/50 bg-secondary/30 text-muted-foreground",
                  )}
                  title={provider.reason ?? undefined}
                >
                  {provider.label}
                  {provider.connected ? " · connected" : " · credentials required"}
                </span>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {result.sourceLabel}
              {result.fx ? ` · USD → INR ${result.fx.rate} (${result.fx.date})` : ""}
              {` · Checked ${formatCheckedAt(result.checkedAt)}`}
            </p>

            {error && (
              <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {result.matches.map((match) => {
                const options = productOptions(match);
                const selected =
                  options.find((product) => product.id === selectedIds[match.itemId]) ??
                  match.product;
                const expanded = expandedItem === match.itemId;
                const withinBudget = (product: Product) =>
                  capInr === null || product.price <= capInr;

                return (
                  <div key={match.itemId} className="rounded-xl border border-border/60 bg-secondary/20 p-4">
                    <div className="mb-3 flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Styling item
                        </p>
                        <p className="text-sm font-medium text-foreground">{match.itemName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Search: {match.searchQuery}
                        </p>
                      </div>
                    </div>

                    {!selected ? (
                      <p className="rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                        No verified product found for this outfit item.
                      </p>
                    ) : (
                      <div className="flex gap-3">
                        <div
                          role="img"
                          aria-label={selected.title}
                          className="h-24 w-20 shrink-0 rounded-lg bg-secondary bg-cover bg-center"
                          style={
                            selected.imageUrl
                              ? { backgroundImage: `url("${selected.imageUrl}")` }
                              : undefined
                          }
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{selected.title}</p>
                            {selected.brand && (
                              <p className="text-xs text-muted-foreground">{selected.brand}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-base font-bold text-foreground">
                              {formatCurrency(selected.price, selected.currency)}
                            </span>
                            {selected.originalPrice && selected.originalPrice > selected.price && (
                              <span className="text-xs text-muted-foreground line-through">
                                {formatCurrency(selected.originalPrice, selected.currency)}
                              </span>
                            )}
                            {selected.discountPercent !== null && (
                              <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">
                                {selected.discountPercent}% off
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                            <span className="rounded-full bg-secondary/70 px-2 py-0.5">{selected.store}</span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5",
                                selected.inStock
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-destructive/10 text-destructive",
                              )}
                            >
                              {selected.inStock ? "In stock" : "Unavailable"}
                            </span>
                            <span>Colour: {selected.colors.length ? selected.colors.join(", ") : "Not provided"}</span>
                            <span>Size: {selected.sizes.length ? selected.sizes.join(", ") : "Not provided"}</span>
                            <span>Verified: {formatCheckedAt(selected.priceVerifiedAt)}</span>
                          </div>
                          {selected.sourcePrice && (
                            <p className="text-[10px] text-muted-foreground">
                              Source price {formatCurrency(selected.sourcePrice.amount, selected.sourcePrice.currency)}
                              {selected.priceConverted ? " converted to INR" : ""}
                            </p>
                          )}
                          {match.availability && (
                            <div className="space-y-1 rounded-lg bg-secondary/40 px-2 py-1.5 text-[11px] text-muted-foreground">
                              <p>{match.availability.message}</p>
                              {match.availability.supported && (
                                <div className="flex flex-wrap gap-2">
                                  {typeof match.availability.available === "boolean" && (
                                    <span>
                                      Serviceable: {match.availability.available ? "Yes" : "No"}
                                    </span>
                                  )}
                                  {match.availability.deliveryDate && (
                                    <span>
                                      Delivery: {match.availability.deliveryDate.min}
                                      {match.availability.deliveryDate.max !== match.availability.deliveryDate.min
                                        ? ` – ${match.availability.deliveryDate.max}`
                                        : ""}
                                    </span>
                                  )}
                                  {!match.availability.deliveryDate && match.availability.deliveryEstimateDays && (
                                    <span>
                                      Delivery: {match.availability.deliveryEstimateDays.min}-
                                      {match.availability.deliveryEstimateDays.max} days
                                    </span>
                                  )}
                                  {match.availability.deliveryChargesInr !== null &&
                                    match.availability.deliveryChargesInr !== undefined && (
                                      <span>
                                        Shipping: {formatCurrency(match.availability.deliveryChargesInr, selected.currency)}
                                      </span>
                                    )}
                                  {match.availability.availableSizes && match.availability.availableSizes.length > 0 && (
                                    <span>Sizes: {match.availability.availableSizes.join(", ")}</span>
                                  )}
                                  {match.availability.availableColors && match.availability.availableColors.length > 0 && (
                                    <span>Colours: {match.availability.availableColors.join(", ")}</span>
                                  )}
                                  {match.availability.checkedAt && (
                                    <span>Checked: {formatCheckedAt(match.availability.checkedAt)}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button size="sm" asChild>
                              <a href={selected.buyUrl} target="_blank" rel="noopener noreferrer" className="gap-1">
                                Buy at {selected.store}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                            <Button variant="secondary" size="sm" asChild>
                              <Link href={`/products/${encodeURIComponent(selected.id)}`}>Details</Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={savingId === selected.id}
                              onClick={() => void toggleFavourite(selected)}
                            >
                              <Heart
                                className={cn(
                                  "h-3 w-3",
                                  favouriteIds.has(selected.id) && "fill-current text-pink-400",
                                )}
                              />
                              {favouriteIds.has(selected.id) ? "Saved" : "Save"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => setExpandedItem(expanded ? null : match.itemId)}
                            >
                              Replace
                              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {options.length > 1 && (
                      <div className="mt-3 space-y-2">
                        {expanded && (
                          <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Verified alternatives within budget
                            </p>
                            {options
                              .filter((product) => product.id !== selected?.id && withinBudget(product))
                              .slice(0, 5)
                              .map((product) => (
                                <div
                                  key={product.id}
                                  className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-2 text-xs"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-foreground">{product.title}</p>
                                    <p className="text-muted-foreground">
                                      {product.store} · {formatCurrency(product.price, product.currency)}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedIds((prev) => ({ ...prev, [match.itemId]: product.id }));
                                      setExpandedItem(null);
                                      toast.success("Item replaced. Outfit total recalculated.");
                                    }}
                                  >
                                    Use
                                  </Button>
                                </div>
                              ))}
                            {options.filter((product) => product.id !== selected?.id && withinBudget(product))
                              .length === 0 && (
                              <p className="text-xs text-muted-foreground">
                                No alternative from a connected provider is within this budget.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass space-y-4 rounded-2xl border border-border/50 p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Compare Prices</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Exact matches are shown only when the same verified product is listed by another
              connected provider. Similar alternatives are never labelled as the same item.
            </p>
            {result.matches.map((match) => {
              const comparison = match.comparison;
              if (!comparison) return null;
              return (
                <div key={match.itemId} className="rounded-xl border border-border/60 bg-secondary/20 p-4">
                  <p className="text-xs font-semibold text-foreground">{match.itemName}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{comparison.note}</p>
                  {comparison.lowestPriceInr !== null && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                      <div className="rounded-lg bg-secondary/40 p-2">
                        <p className="text-muted-foreground">Lowest</p>
                        <p className="font-semibold text-emerald-300">
                          {formatCurrency(comparison.lowestPriceInr, "INR")}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/40 p-2">
                        <p className="text-muted-foreground">Highest</p>
                        <p className="font-semibold text-foreground">
                          {formatCurrency(comparison.highestPriceInr ?? 0, "INR")}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/40 p-2">
                        <p className="text-muted-foreground">Difference</p>
                        <p className="font-semibold text-foreground">
                          {formatCurrency(comparison.priceDifferenceInr ?? 0, "INR")}
                        </p>
                      </div>
                    </div>
                  )}
                  {comparison.exactMatches.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        Exact matches
                      </p>
                      {comparison.exactMatches.map((entry) => (
                        <div
                          key={entry.product.id}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-lg p-2 text-xs",
                            entry.isLowestPrice
                              ? "border border-emerald-400/30 bg-emerald-400/10"
                              : "bg-secondary/30",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-foreground">{entry.product.store}</p>
                            <p className="text-muted-foreground">
                              {entry.product.inStock ? "In stock" : "Unavailable"} · verified{" "}
                              {formatCheckedAt(entry.product.priceVerifiedAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.isLowestPrice && (
                              <span className="flex items-center gap-1 text-[10px] text-emerald-300">
                                <Check className="h-3 w-3" /> Cheapest
                              </span>
                            )}
                            <span className="font-semibold">
                              {formatCurrency(entry.product.price, entry.product.currency)}
                            </span>
                            <Button size="sm" variant="ghost" asChild>
                              <a href={entry.product.buyUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {comparison.similarAlternatives.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Similar alternatives
                      </p>
                      {comparison.similarAlternatives.map((entry) => (
                        <div
                          key={entry.product.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-secondary/20 px-2 py-1.5 text-[11px]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-foreground">{entry.product.title}</p>
                            <p className="text-muted-foreground">
                              {entry.product.store} · {entry.reason}
                            </p>
                          </div>
                          <span className="font-semibold text-foreground">
                            {formatCurrency(entry.product.price, entry.product.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="glass space-y-4 rounded-2xl border border-border/50 p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Complete Outfit Budget</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-secondary/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="mt-1 font-bold text-foreground">
                  {totals !== null ? formatCurrency(totals, "INR") : "Unavailable"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</p>
                <p className={cn("mt-1 font-bold", remaining !== null && remaining < 0 ? "text-destructive" : "text-emerald-300")}>
                  {remaining !== null ? formatCurrency(Math.abs(remaining), "INR") : "Unknown"}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{result.budget?.note ?? budgetCap(budget)}</p>
            {result.budget?.cheapestCompleteOutfitInr !== null &&
              result.budget?.cheapestCompleteOutfitInr !== undefined && (
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-foreground">
                  Cheapest verified complete outfit:{" "}
                  <span className="font-semibold text-primary">
                    {formatCurrency(result.budget.cheapestCompleteOutfitInr, "INR")}
                  </span>
                </div>
              )}
            {!totals && (
              <p className="text-xs text-muted-foreground">
                A complete total is hidden because at least one verified INR price is missing.
              </p>
            )}
          </div>

          <div className="glass space-y-4 rounded-2xl border border-border/50 p-6 text-center backdrop-blur-xl">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Save and Share</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Save the complete outfit, add verified products to favourites, or share the look.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1 gap-2" disabled={isSaving} onClick={onSaveOutfit}>
                <ShoppingBag className="h-3.5 w-3.5" />
                {isSaving ? "Saving..." : "Save outfit"}
              </Button>
              <Button
                className="flex-1 gap-2"
                variant="secondary"
                disabled={savingId === "all"}
                onClick={() => void saveAllFavourites()}
              >
                <Heart className="h-3.5 w-3.5" />
                Add products to favourites
              </Button>
              <Button className="flex-1 gap-2" variant="outline" onClick={() => void shareOutfit()}>
                <Share2 className="h-3.5 w-3.5" />
                Share
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
