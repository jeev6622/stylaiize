"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Bookmark, ShoppingBag, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type {
  BuildYourLookData,
  GroomingPlan,
  OutfitItemType,
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
import type { OutfitData, ScrollStage } from "@/components/build-look/types";
import { FashionScene } from "@/components/build-look/FashionScene";
import { BackgroundEffects } from "@/components/build-look/BackgroundEffects";
import { ScrollProgress } from "@/components/build-look/ScrollProgress";
import { ScrollCard } from "@/components/build-look/ScrollCard";
import { OutfitOverview } from "@/components/build-look/OutfitOverview";
import { ProductInfoCard } from "@/components/build-look/ProductInfoCard";
import { AIAnalysis } from "@/components/build-look/AIAnalysis";
import { GroomingResults } from "@/components/build-look/GroomingResults";
import { ShoppingSummary } from "@/components/build-look/ShoppingSummary";
import { StyleProfileCard } from "@/components/build-look/StyleProfileCard";
import { StyleSelector } from "@/components/build-look/StyleSelector";
import { BudgetSelector } from "@/components/build-look/BudgetSelector";
import {
  BuildLookForm,
  EMPTY_BUILD_LOOK_FORM,
  type BuildLookFormState,
} from "@/components/build-look/BuildLookForm";

const CATEGORY_LABELS: Record<string, string> = {
  upperwear: "Upperwear",
  lowerwear: "Lowerwear",
  footwear: "Footwear",
  accessories: "Accessories",
};

/**
 * Build Your Look items carry a slot (`upperwear`, `lowerwear`, ...) but the
 * saved-outfit API validates `items[].type` against the shared
 * `OUTFIT_ITEM_TYPES` vocabulary. Translate through the shared map and fall
 * back to "accessory" for anything unexpected rather than sending a value the
 * API would reject.
 */
function toOutfitItemType(category: string): OutfitItemType {
  return BUILD_LOOK_CATEGORY_TO_ITEM_TYPE[
    category as (typeof BUILD_LOOK_CATEGORIES)[number]
  ] ?? "accessory";
}

const CATEGORY_SUBTITLES: Record<string, string> = {
  upperwear: "UPPERWEAR",
  lowerwear: "LOWERWEAR",
  footwear: "FOOTWEAR",
  accessories: "ACCESSORIES",
};

/**
 * Builds one scroll stage per real item, then a shopping stage. Derived from
 * the API response so a 4-piece and a 7-piece look each get the right number
 * of sections.
 */
function buildStages(
  look: OutfitData,
  grooming: GroomingPlan | null,
): ScrollStage[] {
  const stages: ScrollStage[] = [
    {
      id: 0,
      kind: "overview",
      title: "Complete Look",
      subtitle: "AI RECOMMENDED LOOK",
      label: "Overview",
      highlightCategories: [],
    },
    {
      id: 1,
      kind: "analysis",
      title: "Style Match",
      subtitle: "01 / AI ANALYSIS",
      label: "Analysis",
      highlightCategories: [],
    },
  ];

  look.items.forEach((item, i) => {
    stages.push({
      id: i + 2,
      kind: "item",
      itemIndex: i,
      title: item.name,
      subtitle: `${String(i + 1).padStart(2, "0")} / ${CATEGORY_SUBTITLES[item.category] ?? item.category.toUpperCase()}`,
      label: CATEGORY_LABELS[item.category] ?? item.category,
      description: item.description || item.subtitle,
      highlightCategories: [item.category],
    });
  });

  if (grooming) {
    stages.push({
      id: stages.length,
      kind: "grooming",
      title: "Grooming",
      subtitle: "FINISHING TOUCHES",
      label: "Grooming",
      highlightCategories: [],
    });
  }

  stages.push({
    id: stages.length,
    kind: "shopping",
    title: "Shopping",
    subtitle: "YOUR LOOK",
    label: "Shop",
    highlightCategories: [],
  });

  return stages;
}

export default function BuildLookPage() {
  const router = useRouter();
  const [activeStage, setActiveStage] = useState(0);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [showReducedMotion, setShowReducedMotion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState<BuildLookFormState>(EMPTY_BUILD_LOOK_FORM);
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [look, setLook] = useState<BuildYourLookData | null>(null);
  const [grooming, setGrooming] = useState<GroomingPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const outfit: OutfitData | null = useMemo(
    () => (look ? toOutfitData(look) : null),
    [look],
  );
  const stages: ScrollStage[] = useMemo(
    () => (outfit ? buildStages(outfit, grooming) : []),
    [outfit, grooming],
  );

  const colors = useMemo(
    () =>
      form.colors
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 8),
    [form.colors],
  );

  /** Shared payload for generate / replace / add — the API requires the brief each time. */
  const brief = useCallback(
    () => ({
      eventName: form.eventName.trim(),
      ...(form.occasion.trim() ? { occasion: form.occasion.trim() } : {}),
      ...(form.dressCode.trim() ? { dressCode: form.dressCode.trim() } : {}),
      style: form.style,
      budget: form.budget,
      ...(colors.length > 0 ? { colors } : {}),
      ...(form.fit.trim() ? { fit: form.fit.trim() } : {}),
      ...(form.brand.trim() ? { brand: form.brand.trim() } : {}),
      ...(form.season.trim() ? { season: form.season.trim() } : {}),
      includeGrooming: form.includeGrooming,
      ...(styleProfile ? { styleProfile } : {}),
    }),
    [colors, form, styleProfile],
  );

  const messageFor = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      if (err.code === "AI_NOT_CONFIGURED") return err.message;
      return err.message || fallback;
    }
    return err instanceof Error && err.message ? err.message : fallback;
  };

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await apiClient.post<{
        look: BuildYourLookData;
        grooming?: GroomingPlan;
      }>(
        API_ENDPOINTS.buildYourLook.generate,
        brief(),
        { timeoutMs: 120_000 },
      );
      setLook(res.look);
      setGrooming(res.grooming ?? null);
      setActiveItemId(null);
      toast.success("Your look is ready.");
    } catch (err) {
      setError(messageFor(err, "Could not build your look. Please try again."));
    } finally {
      setIsGenerating(false);
    }
  }, [brief]);

  const handleReplace = useCallback(
    async (itemId: string) => {
      const currentItems = toApiItems(look);
      if (!currentItems) return;
      setReplacingId(itemId);
      setError(null);
      try {
        const res = await apiClient.post<{ look: BuildYourLookData }>(
          API_ENDPOINTS.buildYourLook.replaceItem,
          { ...brief(), currentItems, itemId },
          { timeoutMs: 120_000 },
        );
        setLook(res.look);
        toast.success("Item replaced.");
      } catch (err) {
        setError(messageFor(err, "Could not replace that item."));
        toast.error(messageFor(err, "Could not replace that item."));
      } finally {
        setReplacingId(null);
      }
    },
    [brief, look],
  );

  const handleAddItem = useCallback(async () => {
    const currentItems = toApiItems(look);
    if (!currentItems) return;
    setIsMutating(true);
    setError(null);
    try {
      const res = await apiClient.post<{ look: BuildYourLookData }>(
        API_ENDPOINTS.buildYourLook.addItem,
        { ...brief(), currentItems },
        { timeoutMs: 120_000 },
      );
      setLook(res.look);
      toast.success("Item added to your look.");
    } catch (err) {
      setError(messageFor(err, "Could not add an item."));
      toast.error(messageFor(err, "Could not add an item."));
    } finally {
      setIsMutating(false);
    }
  }, [brief, look]);

  const handleRegenerate = useCallback(() => {
    setLook(null);
    setGrooming(null);
    setActiveStage(0);
    setActiveItemId(null);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSaveOutfit = useCallback(async () => {
    if (!outfit) return;
    setIsSaving(true);
    try {
      await apiClient.post(API_ENDPOINTS.savedOutfits, {
        name: `Build Your Look — ${form.style} · ${outfit.eventName}`,
        category: "smart_casual",
        occasion: outfit.eventName,
        style: form.style,
        colors: [...new Set(outfit.items.map((i) => i.color).filter(Boolean))],
        budget: outfit.optimizedTotal,
        items: outfit.items.map((i) => ({
          type: toOutfitItemType(i.category),
          name: i.name,
          brand: i.brand || null,
          color: i.color,
          price: i.price,
          currency: "INR",
          buyUrl: null,
          imageUrl: i.imageUrl,
          reason: i.subtitle,
        })),
        scores: {
          fashion: outfit.styleMatch,
          eventMatch: outfit.eventMatch,
          comfort: 0,
          budget: 0,
        },
        totalCost: outfit.optimizedTotal,
        explanation: `AI-curated ${form.style} look for ${outfit.eventName}.`,
        ...(grooming ? { grooming } : {}),
        imageUrl: null,
        source: "build_your_look",
      });
      toast.success("Outfit saved to your collection.");
      router.push("/library");
    } catch (err) {
      toast.error(messageFor(err, "Failed to save outfit."));
    } finally {
      setIsSaving(false);
    }
  }, [form.style, grooming, outfit, router]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setShowReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setShowReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sectionsRef.current.indexOf(entry.target as HTMLElement);
            if (idx !== -1) setActiveStage(idx);
          }
        }
      },
      { threshold: 0.5 },
    );

    sectionsRef.current.forEach((s) => {
      if (s) observer.observe(s);
    });
    return () => observer.disconnect();
  }, [stages.length]);

  const handleHotspotClick = useCallback((itemId: string) => {
    setActiveItemId((prev) => (prev === itemId ? null : itemId));
  }, []);

  const highlightCategories = stages[activeStage]?.highlightCategories ?? [];
  const activeItem = activeItemId
    ? outfit?.items.find((i) => i.id === activeItemId)
    : undefined;

  if (!outfit) {
    return (
      <div className="relative min-h-full overflow-y-auto" style={{ background: "#050816" }}>
        <BackgroundEffects activeStage={0} />
        <div className="relative z-10 mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
          <Link
            href="/"
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
            Describe the event and your AI stylist will curate a complete outfit for it.
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
    <div
      ref={scrollRef}
      className="relative h-full overflow-y-auto scroll-smooth"
      style={{ background: "#050816" }}
    >
      <BackgroundEffects activeStage={activeStage} />

      {/* Fixed 3D Scene */}
      <div className="fixed inset-0 z-0 lg:bottom-auto lg:h-screen lg:w-[60%]">
        <div className="h-[40vh] w-full lg:hidden">
          <FashionScene
            activeStage={activeStage}
            highlightCategories={highlightCategories}
            activeItemId={activeItemId}
            autoRotate={!showReducedMotion}
            items={outfit.items}
            onHotspotClick={handleHotspotClick}
          />
        </div>
        <div className="hidden h-full w-full lg:block">
          <FashionScene
            activeStage={activeStage}
            highlightCategories={highlightCategories}
            activeItemId={activeItemId}
            autoRotate={!showReducedMotion}
            items={outfit.items}
            onHotspotClick={handleHotspotClick}
          />
        </div>
      </div>

      {/* Scroll Progress */}
      {!showReducedMotion && (
        <ScrollProgress
          totalStages={stages.length}
          currentStage={activeStage}
          stageLabels={stages.map((s) => s.subtitle)}
        />
      )}

      {/* Scroll Content Column */}
      <div className="relative z-10 lg:ml-[60%] lg:w-[40%]">
        <section className="flex min-h-[50vh] items-center justify-center px-6 py-12">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Link
                href="/"
                className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="mb-3 text-4xl font-bold tracking-tight text-foreground lg:text-5xl"
            >
              {outfit.eventName}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mb-2 text-lg text-muted-foreground"
            >
              {outfit.styleName} · {outfit.items.length} pieces
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-sm text-muted-foreground/60"
            >
              Scroll down to explore each piece
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-8"
            >
              <Button variant="secondary" size="sm" className="gap-2" onClick={handleRegenerate}>
                <RotateCcw className="h-3.5 w-3.5" />
                Start over
              </Button>
            </motion.div>
          </div>
        </section>

        {stages.map((stage, i) => {
          const isActive = activeStage === i;

          return (
            <section
              key={stage.id}
              ref={(el) => {
                sectionsRef.current[i] = el;
              }}
              className="flex min-h-[80vh] items-center px-6 py-12"
            >
              <div className="w-full max-w-md space-y-6">
                {stage.kind === "overview" && <OutfitOverview data={outfit} />}

                {stage.kind === "analysis" && (
                  <AIAnalysis
                    styleMatch={outfit.styleMatch}
                    eventMatch={outfit.eventMatch}
                    isVisible={isActive}
                  />
                )}

                {stage.kind === "item" && stage.itemIndex !== undefined && (
                  <ScrollCard
                    stage={stage}
                    item={outfit.items[stage.itemIndex]}
                    isActive={isActive}
                    index={stage.itemIndex}
                  />
                )}

                {stage.kind === "grooming" && grooming && (
                  <GroomingResults
                    plan={grooming}
                    isVisible={isActive}
                    isLoading={isGenerating && form.includeGrooming}
                  />
                )}

                {stage.kind === "shopping" && (
                  <>
                    <ShoppingSummary data={outfit} isVisible={isActive} />

                    <div className="glass space-y-4 rounded-2xl border border-border/50 p-6 backdrop-blur-xl">
                      <StyleSelector
                        selected={form.style}
                        onSelect={(s) => setForm((f) => ({ ...f, style: s }))}
                      />
                      <BudgetSelector
                        selected={form.budget}
                        onSelect={(b) => setForm((f) => ({ ...f, budget: b }))}
                      />
                      <Button
                        className="w-full gap-2"
                        variant="secondary"
                        disabled={isMutating}
                        onClick={() => void handleAddItem()}
                      >
                        <Plus className="h-4 w-4" />
                        {isMutating ? "Adding an item..." : "Add one more item"}
                      </Button>
                      <Button
                        className="w-full gap-2"
                        variant="secondary"
                        disabled={isGenerating}
                        onClick={() => void handleGenerate()}
                      >
                        <Sparkles className="h-4 w-4" />
                        {isGenerating ? "Rebuilding..." : "Rebuild with these settings"}
                      </Button>
                    </div>

                    {error && (
                      <p
                        role="alert"
                        className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      >
                        {error}
                      </p>
                    )}

                    <div className="glass space-y-4 rounded-2xl border border-border/50 p-8 text-center backdrop-blur-xl">
                      <Sparkles className="mx-auto h-6 w-6 text-primary" />
                      <h2 className="text-2xl font-bold text-foreground">
                        Your style. Decided by AI.
                      </h2>
                      <p className="text-sm text-muted-foreground">See it. Style it. Buy it for less.</p>
                      <div className="flex gap-3 pt-2">
                        <Button className="flex-1 gap-2" size="lg" asChild>
                          <Link href="/products">
                            <ShoppingBag className="h-4 w-4" />
                            Shop This Look
                          </Link>
                        </Button>
                        <Button
                          className="flex-1 gap-2"
                          variant="secondary"
                          size="lg"
                          disabled={isSaving}
                          onClick={() => void handleSaveOutfit()}
                        >
                          <Bookmark className="h-4 w-4" />
                          {isSaving ? "Saving..." : "Save Outfit"}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Product detail panel */}
      <AnimatePresence>
        {activeItem && (
          <ProductInfoCard
            item={activeItem}
            isVisible={!!activeItem}
            onClose={() => setActiveItemId(null)}
            onReplace={(itemId) => void handleReplace(itemId)}
            isReplacing={replacingId === activeItem.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
