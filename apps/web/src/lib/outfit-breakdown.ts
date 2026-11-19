import type { BuildLookShopMatch, BuildLookShopResult, GroomingPlan } from "@stylaiize/shared";
import type { OutfitData, OutfitItem } from "../components/build-look/types";

export type OutfitBreakdownSectionId =
  | "upperwear"
  | "lowerwear"
  | "footwear"
  | "accessories"
  | "grooming";

export interface OutfitBreakdownItem {
  id: string;
  name: string;
  category: OutfitBreakdownSectionId;
  categoryLabel: string;
  colour: string | null;
  fit: string | null;
  description: string | null;
  reason: string | null;
  shoppingQuery: string | null;
  shopMatch: BuildLookShopMatch | null;
  isGrooming: boolean;
}

export interface OutfitBreakdownSection {
  id: OutfitBreakdownSectionId;
  label: string;
  items: OutfitBreakdownItem[];
}

export const OUTFIT_BREAKDOWN_SECTIONS: ReadonlyArray<{
  id: OutfitBreakdownSectionId;
  label: string;
}> = [
  { id: "upperwear", label: "Upper wear" },
  { id: "lowerwear", label: "Lower wear" },
  { id: "footwear", label: "Footwear" },
  { id: "accessories", label: "Accessories" },
  { id: "grooming", label: "Grooming" },
];

function normalizeCategory(category: string): OutfitBreakdownSectionId {
  const value = category.trim().toLowerCase();
  if (value.includes("upper") || value.includes("jacket") || value.includes("shirt")) return "upperwear";
  if (value.includes("lower") || value.includes("trouser") || value.includes("pant")) return "lowerwear";
  if (value.includes("shoe") || value.includes("foot") || value.includes("loafer")) return "footwear";
  return "accessories";
}

function sectionLabel(id: OutfitBreakdownSectionId): string {
  return OUTFIT_BREAKDOWN_SECTIONS.find((section) => section.id === id)?.label ?? id;
}

function firstText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

export function getVerifiedProduct(match: BuildLookShopMatch | null) {
  if (!match || match.status !== "found") return null;
  return match.product;
}

export function getInspirationImageUrl(outfit: OutfitData): string | null {
  const value = (outfit as OutfitData & { inspirationImageUrl?: string | null }).inspirationImageUrl;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^(https?:\/\/|\/)/.test(trimmed) ? trimmed : null;
}

export function buildOutfitBreakdown(input: {
  outfit: OutfitData;
  grooming: GroomingPlan | null;
  shopResult: BuildLookShopResult | null;
}): OutfitBreakdownSection[] {
  const { outfit, grooming, shopResult } = input;
  const sectionMap = new Map<OutfitBreakdownSectionId, OutfitBreakdownItem[]>(
    OUTFIT_BREAKDOWN_SECTIONS.map((section) => [section.id, []]),
  );

  outfit.items.forEach((item: OutfitItem) => {
    const category = normalizeCategory(item.category);
    const shopMatch = shopResult?.matches.find((match) => match.itemId === item.id) ?? null;
    sectionMap.get(category)?.push({
      id: item.id,
      name: item.name,
      category,
      categoryLabel: sectionLabel(category),
      colour: firstText(item.color),
      fit: firstText(item.size, outfit.fitGuidance),
      description: firstText(item.description, item.subtitle),
      reason: firstText(item.subtitle, item.description, outfit.explanation),
      shoppingQuery: firstText(shopMatch?.searchQuery, outfit.shoppingQueries?.[item.index]),
      shopMatch,
      isGrooming: false,
    });
  });

  grooming?.items.forEach((item, index) => {
    sectionMap.get("grooming")?.push({
      id: `grooming-${item.category}-${index}`,
      name: item.title,
      category: "grooming",
      categoryLabel: "Grooming",
      colour: null,
      fit: null,
      description: firstText(item.tip),
      reason: firstText(item.why, grooming.summary),
      shoppingQuery: null,
      shopMatch: null,
      isGrooming: true,
    });
  });

  return OUTFIT_BREAKDOWN_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    items: sectionMap.get(section.id) ?? [],
  }));
}
