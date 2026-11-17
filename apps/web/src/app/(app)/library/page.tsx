"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Archive,
  Bookmark,
  DollarSign,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCcw,
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";
import {
  API_ENDPOINTS,
  type OutfitCategory,
  type OutfitItem,
  type SavedOutfit,
} from "@stylaiize/shared";

const CATEGORY_LABELS: Record<OutfitCategory, string> = {
  casual: "Casual",
  smart_casual: "Smart Casual",
  formal: "Formal",
  business: "Business",
  party: "Party",
  ethnic: "Ethnic",
  beach: "Beach",
  sport: "Sport",
  travel: "Travel",
};

export default function SavedOutfitsPage() {
  const router = useRouter();
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | OutfitCategory>("all");

  const [renameTarget, setRenameTarget] = useState<SavedOutfit | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ outfits: SavedOutfit[] }>(
        API_ENDPOINTS.savedOutfits,
      );
      setOutfits(res.outfits ?? []);
    } catch {
      setOutfits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`${API_ENDPOINTS.savedOutfits}/${id}`);
      setOutfits((prev) => prev.filter((o) => o.id !== id));
      toast.success("Outfit removed from your collection.");
    } catch {
      toast.error("Failed to remove outfit.");
    }
  };

  const handleTryOn = (outfit: SavedOutfit) => {
    const top = outfit.items[0];
    const garment = top?.name?.trim() || outfit.name;
    router.push(`/try-on?garment=${encodeURIComponent(garment)}`);
  };

  const handleShop = (item: OutfitItem) => {
    if (item.buyUrl) {
      window.open(item.buyUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const q = [item.name, item.brand].filter(Boolean).join(" ");
    router.push(`/products?q=${encodeURIComponent(q)}`);
  };

  const openRename = (outfit: SavedOutfit) => {
    setRenameTarget(outfit);
    setRenameValue(outfit.name);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error("Enter a name for the outfit.");
      return;
    }
    setRenaming(true);
    try {
      const res = await apiClient.patch<{ outfit: SavedOutfit }>(
        `${API_ENDPOINTS.savedOutfits}/${renameTarget.id}`,
        { name },
      );
      setOutfits((prev) =>
        prev.map((o) => (o.id === renameTarget.id ? res.outfit : o)),
      );
      setRenameTarget(null);
      toast.success("Outfit renamed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to rename outfit.");
    } finally {
      setRenaming(false);
    }
  };

  const handleRegenerate = async (id: string) => {
    setRegeneratingId(id);
    try {
      const res = await apiClient.post<{ outfit: SavedOutfit }>(
        `${API_ENDPOINTS.savedOutfits}/${id}/regenerate`,
      );
      setOutfits((prev) => prev.map((o) => (o.id === id ? res.outfit : o)));
      toast.success("Outfit regenerated with a fresh take.");
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Failed to regenerate outfit. Check that an AI provider is configured.",
      );
    } finally {
      setRegeneratingId(null);
    }
  };

  const categories: ("all" | OutfitCategory)[] = [
    "all",
    "casual",
    "smart_casual",
    "formal",
    "business",
    "party",
    "ethnic",
    "beach",
    "sport",
    "travel",
  ];

  const filtered = outfits.filter((o) => {
    if (category !== "all" && o.category !== category) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.items.some((i) => i.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <Bookmark className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Saved Outfits</h1>
          <p className="text-sm text-muted-foreground">
            Your personalized collection, ready to revisit or shop
          </p>
        </div>
        <div className="ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search outfits..."
              className="w-64 pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Category filter */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
                  category === c
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {c === "all" ? "All" : CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4">
                <Archive className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                {outfits.length === 0 ? "No saved outfits yet" : "No matches"}
              </h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                {outfits.length === 0
                  ? "Generate outfit ideas and tap “Save” to build your personal collection here."
                  : "Try a different search or category filter."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((outfit) => (
                <motion.div
                  key={outfit.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="h-full overflow-hidden">
                    <CardContent className="p-5">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold">{outfit.name}</h3>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {CATEGORY_LABELS[outfit.category]}
                        </Badge>
                      </div>

                      {outfit.style && (
                        <p className="mb-3 text-xs text-muted-foreground">
                          {outfit.style}
                        </p>
                      )}

                      <div className="mb-3 space-y-1.5">
                        {outfit.items.slice(0, 5).map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 rounded-md bg-secondary/30 px-2.5 py-1.5"
                          >
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="min-w-0 flex-1 truncate text-xs">
                              {item.name}
                            </span>
                            {item.price != null && (
                              <span className="shrink-0 text-[11px] font-medium">
                                {formatCurrency(item.price)}
                              </span>
                            )}
                            {item.buyUrl ? (
                              <a
                                href={item.buyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-primary"
                                title="Visit store"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <button
                                onClick={() => handleShop(item)}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-primary"
                                title="Search online for this item"
                              >
                                <ShoppingCart className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                        {outfit.items.length > 5 && (
                          <p className="pl-1 text-[11px] text-muted-foreground">
                            +{outfit.items.length - 5} more item
                            {outfit.items.length - 5 > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>

                      <div className="mb-3 flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          Total
                        </span>
                        <span className="text-sm font-bold">
                          {outfit.totalCost != null
                            ? formatCurrency(outfit.totalCost)
                            : "N/A"}
                        </span>
                      </div>

                      <p className="mb-4 line-clamp-2 text-xs text-muted-foreground">
                        {outfit.explanation}
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleTryOn(outfit)}
                        >
                          <ScanLine className="h-3.5 w-3.5" />
                          Try On
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={regeneratingId === outfit.id}
                          onClick={() => void handleRegenerate(outfit.id)}
                        >
                          {regeneratingId === outfit.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-3.5 w-3.5" />
                          )}
                          Regenerate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => openRename(outfit)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-destructive hover:text-destructive"
                          onClick={() => void handleDelete(outfit.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename outfit</DialogTitle>
            <DialogDescription>
              Give this look a name you will recognize later.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="e.g. Weekend brunch look"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename();
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={renaming}
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleRename()} disabled={renaming}>
              {renaming && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
