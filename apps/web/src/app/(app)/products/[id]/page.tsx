"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  ExternalLink,
  Heart,
  Loader2,
  Search,
  ShoppingCart,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { API_ENDPOINTS, type Product } from "@stylaiize/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return null;
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.3;
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
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

function isDemoProduct(product: Product): boolean {
  return !product.buyUrl || product.buyUrl === "#" || /^prod-\d+/i.test(product.id);
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [product, setProduct] = useState<Product | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavourite, setIsFavourite] = useState(false);
  const [savingFavourite, setSavingFavourite] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detailRes, favRes] = await Promise.all([
        apiClient.get<{ product: Product; demoMode?: boolean }>(
          `${API_ENDPOINTS.products}/${encodeURIComponent(id)}`,
        ),
        apiClient.get<{ favourites: Product[] }>(API_ENDPOINTS.account.favourites),
      ]);
      setProduct(detailRes.product);
      setDemoMode(detailRes.demoMode === true);
      setIsFavourite(favRes.favourites.some((p) => p.id === detailRes.product.id));
    } catch (err) {
      setProduct(null);
      setError(err instanceof Error ? err.message : "Failed to load product details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggleFavourite() {
    if (!product) return;
    if (demoMode || isDemoProduct(product)) {
      toast.error("Demo catalog items cannot be saved as favourites.");
      return;
    }
    setSavingFavourite(true);
    try {
      if (isFavourite) {
        await apiClient.delete(
          `${API_ENDPOINTS.account.favourites}/${encodeURIComponent(product.id)}`,
        );
        setIsFavourite(false);
        toast.success("Removed from favourites.");
      } else {
        await apiClient.post(API_ENDPOINTS.account.favourites, { product });
        setIsFavourite(true);
        toast.success("Saved to favourites.");
      }
    } catch {
      toast.error(isFavourite ? "Failed to remove favourite." : "Failed to save favourite.");
    } finally {
      setSavingFavourite(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Back to products">
            <Link href="/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Product Details</h1>
            <p className="text-sm text-muted-foreground">Review and save items from search</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {loading ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          ) : error ? (
            <div className="glass flex flex-col items-center rounded-2xl p-10 text-center">
              <div className="mb-4 rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Couldn&apos;t load product</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">{error}</p>
              <div className="mt-6 flex gap-3">
                <Button variant="secondary" onClick={() => void load()}>
                  Try again
                </Button>
                <Button asChild>
                  <Link href="/products">Back to search</Link>
                </Button>
              </div>
            </div>
          ) : !product ? (
            <div className="glass flex flex-col items-center rounded-2xl p-10 text-center">
              <div className="mb-4 rounded-full bg-secondary p-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Product not found</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This product may no longer be available in the catalog.
              </p>
              <Button className="mt-6" asChild>
                <Link href="/products">Browse products</Link>
              </Button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-6"
            >
              {(demoMode || isDemoProduct(product)) && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Sample catalog data.</span>{" "}
                    Live store details may be unavailable for this item. Prices and availability
                    are for demo purposes only.
                  </p>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
                <div className="glass overflow-hidden rounded-2xl p-4">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-secondary/50">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
                    )}
                  </div>
                </div>

                <div className="glass space-y-5 rounded-2xl p-6">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{product.store}</Badge>
                      <Badge
                        variant={product.inStock ? "secondary" : "destructive"}
                        className={cn(product.inStock && "text-emerald-400")}
                      >
                        {product.inStock ? "In stock" : "Out of stock"}
                      </Badge>
                      {product.category && (
                        <Badge variant="secondary" className="capitalize">
                          {product.category}
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">{product.title}</h2>
                    {product.brand && (
                      <p className="mt-1 text-sm text-muted-foreground">{product.brand}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="text-3xl font-bold text-foreground">
                        {formatCurrency(product.price, product.currency || "INR")}
                      </span>
                      {product.originalPrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatCurrency(product.originalPrice, product.currency || "INR")}
                        </span>
                      )}
                      {product.discountPercent ? (
                        <Badge variant="secondary" className="text-emerald-400">
                          {product.discountPercent}% off
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <StarRating rating={product.rating} />
                      {product.rating !== null && <span>{product.rating}</span>}
                      {product.reviewCount !== null && (
                        <span>({product.reviewCount.toLocaleString()} reviews)</span>
                      )}
                    </div>
                  </div>

                  {(product.colors.length > 0 || product.sizes.length > 0) && (
                    <div className="space-y-3 text-sm">
                      {product.colors.length > 0 && (
                        <div>
                          <p className="mb-1 font-medium text-foreground">Colors</p>
                          <div className="flex flex-wrap gap-2">
                            {product.colors.map((c) => (
                              <span
                                key={c}
                                className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {product.sizes.length > 0 && (
                        <div>
                          <p className="mb-1 font-medium text-foreground">Sizes</p>
                          <div className="flex flex-wrap gap-2">
                            {product.sizes.map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {product.deliveryEstimateDays && (
                    <p className="text-sm text-muted-foreground">
                      Estimated delivery: {product.deliveryEstimateDays.min}–
                      {product.deliveryEstimateDays.max} days
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 pt-2">
                    {product.buyUrl && product.buyUrl !== "#" ? (
                      <Button asChild className="gap-2">
                        <a href={product.buyUrl} target="_blank" rel="noopener noreferrer">
                          Visit store
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant={isFavourite ? "secondary" : "outline"}
                      className={cn(
                        "gap-2",
                        isFavourite && "border-pink-500/40 bg-pink-500/10 text-pink-300",
                      )}
                      onClick={() => void handleToggleFavourite()}
                      disabled={savingFavourite}
                    >
                      {savingFavourite ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Heart className={cn("h-4 w-4", isFavourite && "fill-current")} />
                      )}
                      {isFavourite ? "Saved" : "Save to favourites"}
                    </Button>
                    <Button variant="secondary" asChild className="gap-2">
                      <Link href="/products">
                        <Bell className="h-4 w-4" />
                        Price alerts &amp; search
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
