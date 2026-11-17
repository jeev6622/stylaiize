"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Shirt,
  Tag,
  Loader2,
  Search,
  Sparkles,
  ImagePlus,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { apiClient, ApiError } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";
import {
  API_ENDPOINTS,
  WARDROBE_CATEGORIES,
  type WardrobeItem,
  type Wardrobe,
  type WardrobeCategory,
} from "@stylaiize/shared";

const CATEGORY_LABELS: Record<WardrobeCategory, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  outerwear: "Outerwear",
  dresses: "Dresses",
  footwear: "Footwear",
  accessories: "Accessories",
  bags: "Bags",
  ethnic: "Ethnic",
  sportswear: "Sportswear",
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name (A-Z)" },
  { value: "mostWorn", label: "Most worn" },
  { value: "leastWorn", label: "Least worn" },
  { value: "price", label: "Price (high to low)" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

interface CategorizeDraft {
  name: string;
  category: WardrobeCategory;
  color: string;
  brand: string | null;
  tags: string[];
  imageUrl: string | null;
  imageUploadToken: string | null;
  confidence: number;
}

interface FormData {
  name: string;
  category: WardrobeCategory | "";
  color: string;
  brand: string;
  purchasedPrice: string;
  tags: string;
  /** Preview URL for the currently attached image. */
  imageUrl: string;
  /**
   * Signed claim for an image we uploaded but have not saved yet. The server
   * resolves it to the storage id, so it must be sent instead of `imageUrl`
   * whenever the user picked a new photo.
   */
  imageUploadToken: string | null;
}

const EMPTY_FORM: FormData = {
  name: "",
  category: "",
  color: "",
  brand: "",
  purchasedPrice: "",
  tags: "",
  imageUrl: "",
  imageUploadToken: null,
};

export default function WardrobePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [summary, setSummary] = useState<Wardrobe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<WardrobeCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortValue>("newest");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [draftConfidence, setDraftConfidence] = useState<number | null>(null);
  const [wornId, setWornId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Debounce so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("category", filter);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      params.set("sort", sort);
      const query = params.toString();

      const [itemsRes, summaryRes] = await Promise.all([
        apiClient.get<{ items: WardrobeItem[] }>(
          `${API_ENDPOINTS.wardrobe}${query ? `?${query}` : ""}`,
        ),
        apiClient.get<Wardrobe>(`${API_ENDPOINTS.wardrobe}/summary`),
      ]);
      setItems(itemsRes.items);
      setSummary(summaryRes);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load wardrobe.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [user, filter, debouncedSearch, sort]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreateDialog() {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setDraftConfidence(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: WardrobeItem) {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category,
      color: item.color,
      brand: item.brand ?? "",
      purchasedPrice: item.purchasedPrice?.toString() ?? "",
      tags: item.tags.join(", "),
      imageUrl: item.imageUrl ?? "",
      // The stored image is already saved, so there is no token to re-send.
      imageUploadToken: null,
    });
    setDraftConfidence(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setDraftConfidence(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Stores the picked image and puts the returned URL + token in the form. */
  async function handleImagePick(file: File) {
    setIsUploading(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await apiClient.post<{
        imageUrl: string;
        imageUploadToken: string;
      }>(API_ENDPOINTS.wardrobeUpload, body, { timeoutMs: 60_000 });
      setForm((prev) => ({
        ...prev,
        imageUrl: res.imageUrl,
        imageUploadToken: res.imageUploadToken,
      }));
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to upload the image.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  /** Sends the image to the AI to prefill the item fields. */
  async function handleCategorize(file: File) {
    setIsCategorizing(true);
    setDraftConfidence(null);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await apiClient.post<{ draft: CategorizeDraft }>(
        API_ENDPOINTS.wardrobeCategorize,
        body,
        { timeoutMs: 120_000 },
      );
      const d = res.draft;
      setForm((prev) => ({
        ...prev,
        name: d.name || prev.name,
        category: d.category || prev.category,
        color: d.color || prev.color,
        brand: d.brand ?? prev.brand,
        tags: d.tags.length > 0 ? d.tags.join(", ") : prev.tags,
        imageUrl: d.imageUrl ?? prev.imageUrl,
        imageUploadToken: d.imageUploadToken,
      }));
      setDraftConfidence(d.confidence);
      toast.success("AI filled in the details. Please review before saving.");
    } catch (err) {
      if (err instanceof ApiError && err.code === "AI_NOT_CONFIGURED") {
        toast.error(err.message);
      } else {
        toast.error(
          err instanceof ApiError ? err.message : "AI could not identify this item.",
        );
      }
    } finally {
      setIsCategorizing(false);
    }
  }

  function onFileSelected(file: File | undefined) {
    if (!file) return;
    if (editingItem) {
      void handleImagePick(file);
    } else {
      void handleCategorize(file);
    }
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.category || !form.color.trim()) {
      toast.error("Name, category, and color are required.");
      return;
    }

    setIsSubmitting(true);
    const payload = {
      name: form.name.trim(),
      category: form.category as WardrobeCategory,
      color: form.color.trim(),
      brand: form.brand.trim() || null,
      purchasedPrice: form.purchasedPrice ? parseFloat(form.purchasedPrice) : null,
      tags: form.tags
        ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      // The server derives imageUrl from the token, so send the token when we
      // have one and omit imageUrl entirely rather than sending a raw URL.
      ...(form.imageUploadToken
        ? { imageUploadToken: form.imageUploadToken }
        : form.imageUrl
          ? { imageUrl: form.imageUrl }
          : {}),
    };

    try {
      if (editingItem) {
        await apiClient.patch(`${API_ENDPOINTS.wardrobe}/${editingItem.id}`, payload);
        toast.success("Item updated!");
      } else {
        await apiClient.post(API_ENDPOINTS.wardrobe, payload);
        toast.success("Item added to wardrobe!");
      }
      closeDialog();
      void loadData();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : editingItem
            ? "Failed to update item."
            : "Failed to add item.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMarkWorn(item: WardrobeItem) {
    setWornId(item.id);
    try {
      await apiClient.post(`${API_ENDPOINTS.wardrobe}/${item.id}/wear`);
      toast.success(`Logged a wear for ${item.name}.`);
      void loadData();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to log this wear.",
      );
    } finally {
      setWornId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`${API_ENDPOINTS.wardrobe}/${id}`);
      setDeleteConfirmId(null);
      toast.success("Item removed.");
      void loadData();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete item.",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isFiltered = filter !== "all" || debouncedSearch.trim().length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">My Wardrobe</h1>
          <p className="text-sm text-muted-foreground">
            Manage your clothing collection
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Stats Bar */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 border-b border-border px-6 py-4">
          <div className="rounded-xl border border-border bg-card/50 px-4 py-3 text-center">
            <p className="text-2xl font-bold">{summary.totalItems}</p>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </div>
          <div className="rounded-xl border border-border bg-card/50 px-4 py-3 text-center">
            <p className="text-2xl font-bold">{summary.wardrobeUtilization}%</p>
            <p className="text-xs text-muted-foreground">Utilization</p>
          </div>
          <div className="rounded-xl border border-border bg-card/50 px-4 py-3 text-center">
            <p className="text-2xl font-bold">
              {formatCurrency(summary.moneySaved)}
            </p>
            <p className="text-xs text-muted-foreground">Money Saved</p>
          </div>
        </div>
      )}

      {/* Search + Sort */}
      <div className="flex flex-col gap-2 border-b border-border px-6 py-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, color, brand, or tag"
            className="pl-9"
            aria-label="Search wardrobe"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortValue)}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Sort wardrobe">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 overflow-x-auto border-b border-border px-6 py-3">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
            filter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </button>
        {WARDROBE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              filter === cat
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-4">
              <Shirt className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">
              {isFiltered
                ? "No matching items"
                : "Your wardrobe is empty"}
            </h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              {isFiltered
                ? "Try a different search term or category."
                : "Add items you own — or upload a photo and let the AI fill in the details."}
            </p>
            {!isFiltered && (
              <Button onClick={openCreateDialog} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Item
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card/50 p-4 transition-colors hover:border-primary/30"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="mb-3 h-40 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="mb-3 grid h-40 w-full place-items-center rounded-xl bg-secondary/40">
                    <Shirt className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{item.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {CATEGORY_LABELS[item.category]}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span
                          className="inline-block h-3 w-3 rounded-full border border-border"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.color}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(item)}
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      onClick={() => setDeleteConfirmId(item.id)}
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <Separator className="my-3" />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {item.brand && <span className="font-medium">{item.brand}</span>}
                    {item.purchasedPrice !== null && (
                      <span>{formatCurrency(item.purchasedPrice)}</span>
                    )}
                    {item.costPerWear !== null && item.costPerWear > 0 && (
                      <span title="Cost per wear">
                        {formatCurrency(item.costPerWear)}/wear
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-foreground">{item.timesWorn}x</span>
                    worn
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full gap-1.5"
                  disabled={wornId === item.id}
                  onClick={() => void handleMarkWorn(item)}
                >
                  {wornId === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  I wore this today
                </Button>

                {item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-0.5 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Item" : "Add Wardrobe Item"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the details of your wardrobe item."
                : "Add an item manually, or upload a photo and let the AI fill in the details."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {!editingItem && (
              <div className="grid gap-2">
                <Label htmlFor="photo">Photo (AI auto-fill)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={isCategorizing || isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isCategorizing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isCategorizing ? "Identifying..." : "Upload & auto-fill"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    JPEG, PNG, WebP, GIF or AVIF
                  </span>
                </div>
                {draftConfidence !== null && (
                  <p className="text-xs text-muted-foreground">
                    AI confidence: {draftConfidence}%. Please check the details before
                    saving.
                  </p>
                )}
              </div>
            )}

            {form.imageUrl && (
              <div className="relative h-40 w-full overflow-hidden rounded-xl bg-secondary/30">
                <img
                  src={form.imageUrl}
                  alt="Selected item"
                  className="h-full w-full object-cover"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="absolute right-2 top-2 gap-1.5"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  Change
                </Button>
              </div>
            )}

            {/* One input serves both the auto-fill and the change-photo action. */}
            <input
              ref={fileInputRef}
              id="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="sr-only"
              onChange={(e) => {
                onFileSelected(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g. White Cotton Shirt"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Category *</Label>
              <Select
                value={form.category}
                onValueChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    category: val as WardrobeCategory,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {WARDROBE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="color">Color *</Label>
              <Input
                id="color"
                placeholder="e.g. Navy Blue"
                value={form.color}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, color: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                placeholder="e.g. Zara"
                value={form.brand}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, brand: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="price">Purchased Price</Label>
              <Input
                id="price"
                type="number"
                min={0}
                placeholder="0"
                value={form.purchasedPrice}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    purchasedPrice: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="e.g. casual, summer, cotton"
                value={form.tags}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, tags: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editingItem ? (
                "Update"
              ) : (
                "Add Item"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this item from your wardrobe? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirmId && void handleDelete(deleteConfirmId)
              }
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
