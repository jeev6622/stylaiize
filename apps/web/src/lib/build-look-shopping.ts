import type {
  BuildLookBudget,
  BuildLookShopResult,
  BuildYourLookData,
  CompleteOutfitImageRequest,
  ShopAudience,
} from "@stylaiize/shared";

export interface BuildLookContext {
  audience: ShopAudience;
  occasion?: string;
  style?: string;
  budget?: BuildLookBudget;
  colors?: string[];
  fit?: string;
}

const CATEGORY_TERMS: Record<string, string> = {
  upperwear: "formal shirt",
  lowerwear: "tailored trousers",
  footwear: "formal shoes",
  accessories: "formal accessories",
  dresses: "dress",
  ethnic: "ethnic wear",
  outerwear: "formal blazer",
};

function clean(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function audienceTerm(audience: ShopAudience): string {
  if (audience === "men") return "men's";
  if (audience === "women") return "women's";
  if (audience === "unisex") return "unisex";
  return "";
}

function itemCategoryTerm(item: BuildYourLookData["items"][number]): string {
  const name = clean(item.name).toLowerCase();
  if (/\b(blouse)\b/.test(name)) return "blouse";
  if (/\b(shirt|t-shirt|tee|top)\b/.test(name)) return "shirt";
  if (/\b(trouser|pant|chino|jeans)\b/.test(name)) return "tailored trousers";
  if (/\b(loafer)\b/.test(name)) return "leather loafers";
  if (/\b(shoe|footwear|oxford|derby|brogue)\b/.test(name)) return "formal shoes";
  if (/\bbelt\b/.test(name)) return "belt";
  if (/\b(watch|timepiece)\b/.test(name)) return "watch";
  if (/\b(dress|gown)\b/.test(name)) return "dress";
  if (/\bskirt\b/.test(name)) return "skirt";
  if (/\b(blazer|jacket|coat)\b/.test(name)) return "blazer";
  return CATEGORY_TERMS[clean(item.category).toLowerCase()] ?? clean(item.category);
}

function uniqueParts(parts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    const value = clean(part).toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function buildItemShoppingQueries(
  look: BuildYourLookData,
  context: BuildLookContext,
): string[] {
  const occasion = clean(context.occasion || look.eventName);
  const style = clean(context.style || look.styleName);
  const budget = context.budget ? `under ${context.budget} rupees` : "";

  return look.items.map((item) => {
    const category = itemCategoryTerm(item);
    const color = clean(item.color);
    const material = clean(
      (item as BuildYourLookData["items"][number] & { material?: string | null }).material,
    );
    const parts = uniqueParts([
      audienceTerm(context.audience),
      color,
      category,
      clean(item.name),
      material,
      occasion,
      style,
      budget,
    ]);
    return parts.join(" ").slice(0, 200);
  });
}

export function buildCompleteOutfitImageRequestPayload(
  look: BuildYourLookData,
  context: BuildLookContext,
  shopResult?: BuildLookShopResult | null,
): CompleteOutfitImageRequest {
  const recommendedColors = (look.recommendedColors ?? [])
    .map((color) => clean(color))
    .filter(Boolean);
  const itemColors = look.items.map((item) => clean(item.color)).filter(Boolean);
  const matchesById = new Map(
    (shopResult?.matches ?? []).map((match) => [match.itemId, match]),
  );

  return {
    eventName: look.eventName,
    audience: context.audience,
    occasion: clean(context.occasion || look.eventName) || undefined,
    dressCode: clean(look.dressCode) || undefined,
    dressCodeReason: clean(look.dressCodeReason) || undefined,
    style: clean(context.style || look.styleName),
    budget: context.budget,
    colors: [...new Set([...recommendedColors, ...itemColors, ...(context.colors ?? [])])].slice(
      0,
      12,
    ),
    fit: clean(context.fit) || undefined,
    fitGuidance: clean(look.fitGuidance) || undefined,
    colorCombination: clean(look.colorCombination) || undefined,
    footwear: clean(look.footwear) || undefined,
    accessories: look.accessories?.map((entry) => clean(entry)).filter(Boolean),
    occasionSuitability: clean(look.occasionSuitability) || undefined,
    seasonSuitability: clean(look.seasonSuitability) || undefined,
    explanation: clean(look.explanation) || undefined,
    items: look.items.map((item) => {
      const product =
        matchesById.get(item.id)?.status === "found"
          ? matchesById.get(item.id)?.product
          : null;
      return {
        id: item.id,
        name: clean(product?.title) || clean(item.name),
        category: clean(item.category),
        color: clean(item.color) || clean(product?.colors?.[0]) || "not specified",
        material: clean(
          (item as BuildYourLookData["items"][number] & { material?: string | null }).material,
        ) || undefined,
        size: clean(product?.sizes?.[0]) || clean(item.size) || undefined,
        description: clean(item.description) || undefined,
        productId: product?.id,
        imageUrl: product?.imageUrl ?? null,
        brand: product?.brand ?? null,
        price: product?.price,
        currency: product?.currency,
        colors: product?.colors,
        sizes: product?.sizes,
        source: clean(product?.sourceLabel || shopResult?.sourceLabel || shopResult?.source) || undefined,
      };
    }),
  };
}

export function buildLookShopFingerprint(
  look: BuildYourLookData,
  context: BuildLookContext,
): string {
  return JSON.stringify({
    items: look.items.map((item) => [item.id, item.name, item.category, item.color]),
    audience: context.audience,
    occasion: clean(context.occasion || look.eventName),
    style: clean(context.style || look.styleName),
    budget: context.budget ?? null,
  });
}
