"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Plus, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import type {
  BuildLookAudience,
  BuildLookShopResult,
  BuildYourLookData,
  CompleteOutfitImageResponse,
  CompleteOutfitImageStatus,
  GroomingPlan,
  OutfitItemType,
  Product,
  ShopAudience,
  StyleProfile,
} from "@stylaiize/shared";
import { Button } from "@/components/ui/button";
import { apiClient, ApiError } from "@/lib/api";
import {
  API_ENDPOINTS,
  BUILD_LOOK_CATEGORIES,
  BUILD_LOOK_CATEGORY_TO_ITEM_TYPE,
} from "@stylaiize/shared";
import { toOutfitData, toApiItems } from "@/lib/build-look";
import {
  buildCompleteOutfitImageRequestPayload,
  buildItemShoppingQueries,
  buildLookShopFingerprint,
  type BuildLookContext,
} from "@/lib/build-look-shopping";
import {
  readAvatarPreference,
  resolveAvatarSelection,
  writeAvatarPreference,
} from "@/lib/avatar-selection";
import {
  clearBuildLookSession,
  readBuildLookSession,
  writeBuildLookSession,
} from "@/lib/build-look-session";
import {
  buildLookProductSearchContext,
  buildProductSearchHref,
  getAudienceProviderNotice,
} from "@/lib/product-search";
import {
  buildOutfitPieces,
  findOutfitPiece,
} from "@/lib/outfit-pieces";
import type { OutfitData } from "@/components/build-look/types";
import type { FashionModelId } from "@/components/build-look/fashion-model-catalog";
import { BackgroundEffects } from "@/components/build-look/BackgroundEffects";
import { CompleteOutfitImage } from "@/components/build-look/CompleteOutfitImage";
import { OutfitStudio } from "@/components/build-look/OutfitStudio";
import { OutfitSummaryPanel } from "@/components/build-look/OutfitSummaryPanel";
import { OutfitPieceBreakdown } from "@/components/build-look/OutfitPieceBreakdown";
import { OutfitShoppingList } from "@/components/build-look/OutfitShoppingList";
import {
  OutfitPieceRail,
  OutfitProductPanel,
} from "@/components/build-look/OutfitPieceRail";
import { SaveShareActions } from "@/components/build-look/SaveShareActions";
import { StyleProfileCard } from "@/components/build-look/StyleProfileCard";
import { StyleSelector } from "@/components/build-look/StyleSelector";
import { BudgetSelector } from "@/components/build-look/BudgetSelector";
import {
  BuildLookForm,
  EMPTY_BUILD_LOOK_FORM,
  type BuildLookFormState,
} from "@/components/build-look/BuildLookForm";

const SCROLL_CONTAINER_ID = "app-main-content";

function getScrollContainer(): HTMLElement | null {
  return document.getElementById(SCROLL_CONTAINER_ID);
}

function parseColors(value: string): string[] {
  return value
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function selectedAudience(
  value: ShopAudience | BuildLookAudience | "" | null | undefined,
): BuildLookAudience | null {
  return value === "men" || value === "women" || value === "unisex" ? value : null;
}



function toOutfitItemType(category: string): OutfitItemType {
  return BUILD_LOOK_CATEGORY_TO_ITEM_TYPE[
    category as (typeof BUILD_LOOK_CATEGORIES)[number]
  ] ?? "accessory";
}


export default function BuildLookPage() {
  const router = useRouter();
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(false);
  const [avatarPreference, setAvatarPreference] = useState<FashionModelId | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState<BuildLookFormState>(EMPTY_BUILD_LOOK_FORM);
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [look, setLook] = useState<BuildYourLookData | null>(null);
  const [grooming, setGrooming] = useState<GroomingPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shopResult, setShopResult] = useState<BuildLookShopResult | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);
  const [isShopping, setIsShopping] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageStatus, setImageStatus] = useState<CompleteOutfitImageStatus | null>(null);
  const [imageMessage, setImageMessage] = useState<string | null>(null);
  const shopRequestRef = useRef(0);
  const shopFingerprintRef = useRef<string | null>(null);
  const imageRequestRef = useRef(0);
  const imageFingerprintRef = useRef<string | null>(null);

  const outfit: OutfitData | null = useMemo(
    () => (look ? toOutfitData(look) : null),
    [look],
  );

  const avatarSelection = useMemo(
    () =>
      resolveAvatarSelection({
        formAudience: selectedAudience(form.audience) ?? undefined,
        generatedAudience: look?.audience ?? null,
        preferredModelId: avatarPreference,
      }),
    [avatarPreference, form.audience, look?.audience],
  );

  const shopAudience: ShopAudience =
    selectedAudience(look?.audience ?? form.audience) ?? "all";

  const outfitPieces = useMemo(
    () => (outfit ? buildOutfitPieces(outfit.items, shopResult, shopAudience) : []),
    [outfit, shopAudience, shopResult],
  );

  const activePiece = useMemo(
    () => findOutfitPiece(outfitPieces, activeItemId),
    [activeItemId, outfitPieces],
  );

  const selectedSlot = activePiece?.slot ?? null;

  const colors = useMemo(
    () =>
      form.colors
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 8),
    [form.colors],
  );

  const lookContext = useMemo<BuildLookContext>(
    () => ({
      audience: shopAudience,
      occasion: form.occasion.trim(),
      style: form.style,
      budget: form.budget,
      colors,
      fit: form.fit.trim(),
    }),
    [colors, form.budget, form.fit, form.occasion, form.style, shopAudience],
  );

  const promptBrief = useCallback(() => {
    const audience = selectedAudience(look?.audience ?? form.audience);
    const eventName = form.eventName.trim();
    if (!audience || eventName.length < 2) return null;
    return {
      eventName,
      audience,
      ...(form.occasion.trim() ? { occasion: form.occasion.trim() } : {}),
      ...(form.dressCode.trim() ? { dressCode: form.dressCode.trim() } : {}),
      style: form.style,
      budget: form.budget,
      ...(colors.length > 0 ? { colors } : {}),
      ...(form.fit.trim() ? { fit: form.fit.trim() } : {}),
      ...(form.brand.trim() ? { brand: form.brand.trim() } : {}),
      ...(form.season.trim() ? { season: form.season.trim() } : {}),
    };
  }, [colors, form, look?.audience]);

  const generateBrief = useCallback(() => {
    const brief = promptBrief();
    if (!brief) return null;
    return {
      ...brief,
      includeGrooming: form.includeGrooming,
      ...(styleProfile ? { styleProfile } : {}),
    };
  }, [form.includeGrooming, promptBrief, styleProfile]);

  const messageFor = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      if (err.code === "AI_NOT_CONFIGURED") return err.message;
      const firstFieldError = err.fieldErrors ? Object.values(err.fieldErrors)[0]?.[0] : null;
      return firstFieldError || err.message || fallback;
    }
    return err instanceof Error && err.message ? err.message : fallback;
  };

  const runShop = useCallback(
    async (
      targetLook: BuildYourLookData,
      context: BuildLookContext,
      options: { force?: boolean } = {},
    ): Promise<BuildLookShopResult | null> => {
      if (targetLook.items.length === 0) return null;
      const fingerprint = buildLookShopFingerprint(targetLook, context);
      if (!options.force && shopFingerprintRef.current === fingerprint) return null;
      const requestId = ++shopRequestRef.current;
      shopFingerprintRef.current = fingerprint;
      setIsShopping(true);
      setShopError(null);
      setShopResult(null);
      try {
        const queries = buildItemShoppingQueries(targetLook, context);
        const result = await apiClient.post<BuildLookShopResult>(
          API_ENDPOINTS.buildYourLook.shop,
          {
            audience: context.audience,
            occasion: context.occasion || targetLook.eventName,
            style: context.style,
            budget: context.budget,
            items: targetLook.items.map((item, index) => ({
              itemId: item.id,
              name: item.name,
              category: item.category,
              color: item.color || null,
              brand: item.brand || null,
              size: item.size || null,
              audience: context.audience,
              style: context.style,
              query: queries[index],
            })),
          },
          { timeoutMs: 120_000 },
        );
        if (requestId !== shopRequestRef.current) return null;
        setShopResult(result);
        return result;
      } catch (err) {
        if (requestId !== shopRequestRef.current) return null;
        setShopError(
          err instanceof Error && err.message
            ? err.message
            : "Live product search is currently unavailable.",
        );
        return null;
      } finally {
        if (requestId === shopRequestRef.current) setIsShopping(false);
      }
    },
    [],
  );

  const runImage = useCallback(
    async (
      targetLook: BuildYourLookData,
      context: BuildLookContext,
      selectedShopResult?: BuildLookShopResult | null,
      options: { force?: boolean } = {},
    ) => {
      if (targetLook.items.length === 0) return;
      const fingerprint = buildLookShopFingerprint(targetLook, context);
      if (!options.force && imageFingerprintRef.current === fingerprint) return;
      const requestId = ++imageRequestRef.current;
      imageFingerprintRef.current = fingerprint;
      setIsGeneratingImage(true);
      setImageStatus(null);
      setImageMessage(null);
      try {
        const result = await apiClient.post<CompleteOutfitImageResponse>(
          API_ENDPOINTS.buildYourLook.completeOutfitImage,
          buildCompleteOutfitImageRequestPayload(targetLook, context, selectedShopResult),
          { timeoutMs: 120_000 },
        );
        if (requestId !== imageRequestRef.current) return;
        const generatedImage = result.completeOutfitImage ?? result.image ?? null;
        setLook((current) =>
          current ? { ...current, completeOutfitImage: generatedImage } : current,
        );
        setImageStatus(result.status === "success" && !generatedImage ? "error" : result.status);
        setImageMessage(result.message ?? null);
      } catch (err) {
        if (requestId !== imageRequestRef.current) return;
        setImageStatus("error");
        setImageMessage(
          err instanceof Error && err.message
            ? err.message
            : "Complete-outfit image generation failed.",
        );
      } finally {
        if (requestId === imageRequestRef.current) setIsGeneratingImage(false);
      }
    },
    [],
  );

  const handleGenerate = useCallback(async () => {
    const brief = generateBrief();
    if (!brief) {
      setError("Select who this look is for and enter an event name.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const res = await apiClient.post<{
        look: BuildYourLookData;
        grooming?: GroomingPlan;
      }>(API_ENDPOINTS.buildYourLook.generate, brief, { timeoutMs: 120_000 });
      const generatedContext: BuildLookContext = {
        ...lookContext,
        audience: selectedAudience(res.look.audience) ?? brief.audience,
      };
      setLook(res.look);
      setGrooming(res.grooming ?? null);
      setActiveItemId(null);
      setShopResult(null);
      setShopError(null);
      setImageStatus(null);
      setImageMessage(null);
      shopFingerprintRef.current = null;
      imageFingerprintRef.current = null;
      toast.success("Your look is ready.");
      const shop = await runShop(res.look, generatedContext);
      void runImage(res.look, generatedContext, shop);
    } catch (err) {
      setError(messageFor(err, "Could not build your look. Please try again."));
    } finally {
      setIsGenerating(false);
    }
  }, [generateBrief, lookContext, runImage, runShop]);

  const handleReplace = useCallback(
    async (itemId: string) => {
      const currentItems = toApiItems(look);
      const brief = promptBrief();
      if (!currentItems || !brief) return;
      setReplacingId(itemId);
      setError(null);
      try {
        const res = await apiClient.post<{ look: BuildYourLookData }>(
          API_ENDPOINTS.buildYourLook.replaceItem,
          { ...brief, currentItems, itemId },
          { timeoutMs: 120_000 },
        );
        setLook(res.look);
        setShopResult(null);
        setShopError(null);
        setImageStatus(null);
        setImageMessage(null);
        shopFingerprintRef.current = null;
        imageFingerprintRef.current = null;
        toast.success("Item replaced.");
      } catch (err) {
        setError(messageFor(err, "Could not replace that item."));
        toast.error(messageFor(err, "Could not replace that item."));
      } finally {
        setReplacingId(null);
      }
    },
    [promptBrief, look],
  );

  const handleAddItem = useCallback(async () => {
    const currentItems = toApiItems(look);
    const brief = promptBrief();
    if (!currentItems || !brief) return;
    setIsMutating(true);
    setError(null);
    try {
      const res = await apiClient.post<{ look: BuildYourLookData }>(
        API_ENDPOINTS.buildYourLook.addItem,
        { ...brief, currentItems },
        { timeoutMs: 120_000 },
      );
      setLook(res.look);
      setShopResult(null);
      setShopError(null);
      setImageStatus(null);
      setImageMessage(null);
      shopFingerprintRef.current = null;
      imageFingerprintRef.current = null;
      toast.success("Item added to your look.");
    } catch (err) {
      setError(messageFor(err, "Could not add an item."));
      toast.error(messageFor(err, "Could not add an item."));
    } finally {
      setIsMutating(false);
    }
  }, [promptBrief, look]);

  const handleShopLook = useCallback(() => {
    if (!look) return;
    void runShop(look, lookContext, { force: true });
  }, [look, lookContext, runShop]);

  const handleRegenerate = useCallback(() => {
    clearBuildLookSession();
    setLook(null);
    setGrooming(null);
    setActiveItemId(null);
    setShopResult(null);
    setShopError(null);
    setImageStatus(null);
    setImageMessage(null);
    shopFingerprintRef.current = null;
    imageFingerprintRef.current = null;
    getScrollContainer()?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSaveOutfit = useCallback(async () => {
    if (!outfit) return;
    setIsSaving(true);
    const productsByItemId = new Map(
      (shopResult?.matches ?? [])
        .filter((match) => match.product)
        .map((match) => [match.itemId, match.product as Product]),
    );
    const products = Array.from(productsByItemId.values());
    const currencies = new Set(products.map((product) => product.currency));
    const allPriced = products.length === outfit.items.length && currencies.size === 1;
    try {
      await apiClient.post(API_ENDPOINTS.savedOutfits, {
        name: `Build Your Look - ${form.style} - ${outfit.eventName}`,
        category: "smart_casual",
        audience: shopAudience,
        occasion: outfit.eventName,
        style: form.style,
        colors: [...new Set(outfit.items.map((i) => i.color).filter(Boolean))],
        budget: outfit.estimatedBudgetInr?.max ?? null,
        items: outfit.items.map((i) => {
          const product = productsByItemId.get(i.id) ?? null;
          return {
            type: toOutfitItemType(i.category),
            name: i.name,
            brand: product?.brand ?? null,
            color: i.color,
            price: product?.price ?? null,
            currency: product?.currency ?? "INR",
            buyUrl: product?.buyUrl ?? null,
            imageUrl: product?.imageUrl ?? null,
            reason: i.description || i.subtitle,
          };
        }),
        scores: {
          fashion: outfit.styleMatch,
          eventMatch: outfit.eventMatch,
          comfort: 0,
          budget: 0,
        },
        totalCost: allPriced
          ? products.reduce((sum, product) => sum + product.price, 0)
          : null,
        explanation: outfit.explanation || `AI-curated ${form.style} styling guidance for ${outfit.eventName}.`,
        ...(grooming ? { grooming } : {}),
        imageUrl: look?.completeOutfitImage?.url ?? null,
        source: "build_your_look",
      });
      toast.success("Outfit saved to your collection.");
      router.push("/library");
    } catch (err) {
      toast.error(messageFor(err, "Failed to save outfit."));
    } finally {
      setIsSaving(false);
    }
  }, [form.style, grooming, look?.completeOutfitImage?.url, outfit, router, shopAudience, shopResult]);

  const productSearchHref = useMemo(() => {
    if (!look) return "/products";
    return buildProductSearchHref(
      buildLookProductSearchContext({
        look,
        audience: shopAudience,
        budget: form.budget,
        occasion: form.occasion,
        style: form.style,
        queries: buildItemShoppingQueries(look, lookContext),
        colors: lookContext.colors,
      }),
    );
  }, [form.budget, form.occasion, form.style, look, lookContext, shopAudience]);

  const shoppingNotice = useMemo(() => {
    const missingReason = shopResult?.matches.find((match) => !match.product && match.reason)?.reason;
    return (
      missingReason ??
      shopError ??
      getAudienceProviderNotice(shopResult?.providers, shopAudience)
    );
  }, [shopAudience, shopError, shopResult]);

  useEffect(() => {
    const saved = readBuildLookSession();
    if (!saved) return;
    const audience = selectedAudience(saved.look.audience ?? saved.form.audience);
    if (!audience) return;
    const restoredForm: BuildLookFormState = { ...saved.form, audience };
    const restoredContext: BuildLookContext = {
      audience,
      occasion: restoredForm.occasion.trim(),
      style: restoredForm.style,
      budget: restoredForm.budget,
      colors: parseColors(restoredForm.colors),
      fit: restoredForm.fit.trim(),
    };
    const fingerprint = buildLookShopFingerprint(saved.look, restoredContext);
    const matches = saved.shopFingerprint === fingerprint;
    setForm(restoredForm);
    setLook(saved.look);
    setGrooming(saved.grooming);
    setShopResult(matches ? saved.shopResult : null);
    setImageStatus(saved.imageStatus);
    setImageMessage(saved.imageMessage);
    shopFingerprintRef.current = matches ? fingerprint : null;
    imageFingerprintRef.current = saved.look.completeOutfitImage ? fingerprint : null;
  }, []);

  useEffect(() => {
    if (!look) return;
    writeBuildLookSession({
      form,
      look,
      grooming,
      shopResult,
      shopFingerprint: buildLookShopFingerprint(look, lookContext),
      imageStatus,
      imageMessage,
    });
  }, [form, grooming, imageMessage, imageStatus, look, lookContext, shopResult]);

  useEffect(() => {
    const saved = readAvatarPreference();
    if (!saved) return;
    const audience = selectedAudience(saved.audience);
    if (audience) {
      setForm((current) => ({ ...current, audience }));
    }
    if (saved.modelId) setAvatarPreference(saved.modelId);
  }, []);

  useEffect(() => {
    const audience = selectedAudience(form.audience);
    if (!audience) return;
    writeAvatarPreference({
      audience,
      modelId: avatarSelection.modelId,
    });
  }, [avatarSelection.modelId, form.audience]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotionPreference = (reduced: boolean) => {
      setAutoRotateEnabled(!reduced);
    };
    applyMotionPreference(mq.matches);
    const handler = (event: MediaQueryListEvent) => applyMotionPreference(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleHotspotClick = useCallback((itemId: string) => {
    setActiveItemId((prev) => (prev === itemId ? null : itemId));
  }, []);

  const handleAvatarModelChange = useCallback((id: FashionModelId) => {
    setAvatarPreference(id);
  }, []);

  const highlightCategories = activeItemId
    ? [outfit?.items.find((item) => item.id === activeItemId)?.category ?? ""]
    : [];


  if (!outfit) {
    return (
      <div className="relative min-h-full" style={{ background: "#050816" }}>
        <BackgroundEffects activeStage={0} />
        <div className="relative z-10 mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
          <Link
            href="/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-2 text-4xl font-bold tracking-tight text-foreground"
          >
            Build Your{" "}
            <span className="bg-gradient-to-r from-primary to-[#06B6D4] bg-clip-text text-transparent">
              Perfect Look
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8 text-muted-foreground"
          >
            Describe the event and your AI stylist will curate complete styling guidance for it.
          </motion.p>
          <div className="mb-6">
            <StyleProfileCard profile={styleProfile} onChange={setStyleProfile} />
          </div>
          <BuildLookForm
            value={form}
            onChange={setForm}
            onSubmit={() => void handleGenerate()}
            isSubmitting={isGenerating}
            error={error}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full" style={{ background: "#050816" }}>
      <BackgroundEffects activeStage={0} />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-10">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {outfit.eventName}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {outfit.styleName} · {outfit.items.length} pieces · {avatarSelection.audienceLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" className="gap-2" asChild>
              <Link href={productSearchHref}>
                <Search className="h-3.5 w-3.5" />
                Search products
              </Link>
            </Button>
            <Button variant="secondary" size="sm" className="gap-2" onClick={handleRegenerate}>
              <RotateCcw className="h-3.5 w-3.5" />
              Start over
            </Button>
          </div>
        </header>

        <CompleteOutfitImage
          image={outfit.completeOutfitImage ?? null}
          audience={shopAudience}
          status={imageStatus}
          message={imageMessage}
          isLoading={isGeneratingImage}
          onGenerate={() => {
            if (look) void runImage(look, lookContext, shopResult, { force: true });
          }}
          onRetry={() => {
            if (look) void runImage(look, lookContext, shopResult, { force: true });
          }}
        />

        <div className="mt-6">
          <OutfitSummaryPanel
            outfit={outfit}
            audience={shopAudience}
            occasion={form.occasion}
            style={form.style}
          />
        </div>

        <div className="mt-6">
          <OutfitPieceBreakdown outfit={outfit} />
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Find products for this look</h2>
              <p className="mt-1 text-xs text-slate-400">
                Product search runs automatically from the recommended pieces.
              </p>
            </div>
            <Button className="gap-2" disabled={isShopping} onClick={handleShopLook}>
              <Search className="h-4 w-4" />
              {isShopping ? "Searching..." : "Search products"}
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <OutfitShoppingList result={shopResult} notice={shoppingNotice} />
        </div>

        <div className="mt-6">
          <OutfitStudio
            modelId={avatarSelection.modelId}
            allowedModelIds={avatarSelection.allowedModelIds}
            onAvatarModelChange={handleAvatarModelChange}
            autoRotate={autoRotateEnabled}
            onAutoRotateChange={setAutoRotateEnabled}
            highlightCategories={highlightCategories}
            activeItemId={activeItemId}
            pieces={outfitPieces}
            selectedSlot={selectedSlot}
            onHotspotClick={handleHotspotClick}
          />
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
            <OutfitPieceRail
              pieces={outfitPieces}
              activePieceId={activeItemId}
              onSelect={handleHotspotClick}
            />
            <OutfitProductPanel piece={activePiece} />
          </div>
        </div>

        <div className="mt-6">
          <SaveShareActions isSaving={isSaving} onSave={() => void handleSaveOutfit()} />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="glass space-y-4 rounded-2xl border border-border/50 p-6 backdrop-blur-xl">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Refine this look</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust the direction, then rebuild or add another item.
              </p>
            </div>
            <StyleProfileCard profile={styleProfile} onChange={setStyleProfile} />
            <StyleSelector
              selected={form.style}
              onSelect={(s) => setForm((f) => ({ ...f, style: s }))}
            />
            <BudgetSelector
              selected={form.budget}
              onSelect={(b) => setForm((f) => ({ ...f, budget: b }))}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1 gap-2"
                variant="secondary"
                disabled={isMutating}
                onClick={() => void handleAddItem()}
              >
                <Plus className="h-4 w-4" />
                {isMutating ? "Adding an item..." : "Add one more item"}
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={isGenerating}
                onClick={() => void handleGenerate()}
              >
                <Sparkles className="h-4 w-4" />
                {isGenerating ? "Rebuilding..." : "Rebuild with these settings"}
              </Button>
            </div>
            {activeItemId && (
              <Button
                className="w-full gap-2"
                variant="outline"
                disabled={replacingId === activeItemId}
                onClick={() => void handleReplace(activeItemId)}
              >
                <RotateCcw className="h-4 w-4" />
                {replacingId === activeItemId ? "Replacing item..." : "Replace selected item"}
              </Button>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
