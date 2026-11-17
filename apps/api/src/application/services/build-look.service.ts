import type {
  BuildYourLookData,
  BuildYourLookItem,
  GroomingItem,
  GroomingPlan,
  StyleProfile,
} from "@stylaiize/shared";
import { BUILD_LOOK_CATEGORIES, GROOMING_CATEGORIES } from "@stylaiize/shared";
import { aiService } from "@/application/services/ai.service";
import * as memoryService from "./memory.service";

const CATEGORIES: readonly string[] = BUILD_LOOK_CATEGORIES;
const GROOMING_CATEGORY_SET = new Set<string>(GROOMING_CATEGORIES);

const BUDGET_LABEL: Record<string, string> = {
  "2000": "~₹2,000 maximum",
  "5000": "~₹5,000 maximum",
  "10000": "~₹10,000 maximum",
  premium: "premium pieces, no strict budget cap",
};

interface LookPrompt {
  eventName: string;
  occasion?: string;
  dressCode?: string;
  style: string;
  budget: string;
  colors?: string[];
  fit?: string;
  brand?: string;
  season?: string;
  includeGrooming?: boolean;
  styleProfile?: StyleProfile;
  /** Internal: loaded from the user's fashion memory when a userId is present. */
  fashionMemoryContext?: string;
  userId?: string;
}

interface RawGroomingItem {
  category?: string;
  title?: string;
  why?: string;
  tip?: string;
  estimatedPriceInr?: number;
}

interface RawGrooming {
  summary?: string;
  items?: RawGroomingItem[];
}

interface RawLookItem {
  id?: string;
  name?: string;
  subtitle?: string;
  description?: string;
  brand?: string | null;
  material?: string;
  color?: string;
  size?: string;
  price?: number;
  originalPrice?: number;
  rating?: number;
  store?: string;
  category?: string;
  imageUrl?: string | null;
}

interface RawLook {
  eventName?: string;
  styleName?: string;
  styleMatch?: number;
  eventMatch?: number;
  items?: RawLookItem[];
  grooming?: RawGrooming;
}

const OUTPUT_SCHEMA = {
  eventName: "string",
  styleName: "string",
  styleMatch: "number 0-100",
  eventMatch: "number 0-100",
  items: [
    {
      id: "string",
      name: "string",
      subtitle: "string",
      description: "string",
      brand: "string|null",
      material: "string",
      color: "string",
      size: "string",
      price: "number (the optimized/discounted price in INR)",
      originalPrice: "number (the typical retail price in INR, >= price)",
      rating: "number 0-5",
      store: "string (e.g. Amazon, Myntra, Flipkart, Ajio, Nykaa)",
      category: "one of upperwear | lowerwear | footwear | accessories",
      imageUrl: "null",
    },
  ],
};

const GROOMING_SCHEMA = {
  summary: "string (one short sentence tying the grooming to the outfit)",
  items: [
    {
      category: "one of hair | facial | skin | accessory | fragrance",
      title: "string",
      why: "string (why it suits this event and outfit)",
      tip: "string (a practical, non-medical tip)",
      estimatedPriceInr: "number (optional, realistic INR amount)",
    },
  ],
};

function outputSchema(includeGrooming: boolean): Record<string, unknown> {
  return includeGrooming
    ? { ...OUTPUT_SCHEMA, grooming: GROOMING_SCHEMA }
    : OUTPUT_SCHEMA;
}

function budgetSentence(budget: string): string {
  return BUDGET_LABEL[budget] ?? BUDGET_LABEL["premium"];
}

function styleProfileSentence(profile: StyleProfile): string {
  const cues = [
    profile.faceShape ? `face shape ${profile.faceShape}` : "",
    profile.hairType ? `hair type ${profile.hairType}` : "",
    profile.hairLength ? `hair length ${profile.hairLength}` : "",
    profile.undertone ? `${profile.undertone} skin undertone` : "",
    profile.bodyBuild ? `${profile.bodyBuild} build` : "",
    profile.paletteSuggestions.length > 0
      ? `flattering colours: ${profile.paletteSuggestions.slice(0, 6).join(", ")}`
      : "",
  ].filter(Boolean);

  return cues.length > 0
    ? `Optional style profile (user-reviewed): ${cues.join("; ")}.`
    : "";
}

async function getFashionMemoryContext(
  userId: string | undefined,
): Promise<string | undefined> {
  if (!userId) return undefined;
  try {
    const memory = await memoryService.getMemory(userId);
    const parts = [
      memory.favoriteColors.length > 0
        ? `favourite colours: ${memory.favoriteColors.slice(0, 8).join(", ")}`
        : "",
      memory.favoriteBrands.length > 0
        ? `preferred brands: ${memory.favoriteBrands.slice(0, 6).join(", ")}`
        : "",
      memory.budget
        ? `usual budget: INR ${memory.budget.min}-${memory.budget.max}`
        : "",
      memory.previousOutfits.length > 0
        ? `recent outfit events: ${memory.previousOutfits
            .slice(-4)
            .map((o) => o.eventId)
            .join(", ")}`
        : "",
    ].filter(Boolean);
    return parts.length > 0 ? parts.join("; ") : undefined;
  } catch {
    // Memory enrichment is best-effort and must never block generation.
    return undefined;
  }
}

function baseInstruction(prompt: LookPrompt, focus: string): string {
  return [
    `Create a complete, polished ${prompt.style}-style outfit for one person for this event. ${focus}`,
    `Event name: ${prompt.eventName}`,
    prompt.occasion ? `Occasion/event type: ${prompt.occasion}` : "",
    prompt.dressCode ? `Dress code: ${prompt.dressCode}` : "",
    `Style: ${prompt.style}`,
    `Budget: ${budgetSentence(prompt.budget)}`,
    prompt.colors?.length ? `Preferred colors: ${prompt.colors.join(", ")}` : "",
    prompt.fit ? `Fit preference: ${prompt.fit}` : "",
    prompt.brand ? `Preferred brand: ${prompt.brand}` : "",
    prompt.season ? `Season: ${prompt.season}` : "",
    prompt.styleProfile ? styleProfileSentence(prompt.styleProfile) : "",
    prompt.fashionMemoryContext
      ? `Fashion memory (reuse what already works for this person): ${prompt.fashionMemoryContext}`
      : "",
    "Include at least 4 and at most 7 items: at least one outerwear/upperwear, one lowerwear, one footwear, and one accessory.",
    "Use realistic Indian retail prices in INR. Each item must have a realistic brand and a store it is sold at.",
    ...(prompt.includeGrooming
      ? [
          "Also return a grooming plan with 4-6 items. Cover hair, facial grooming, skin prep, accessories and fragrance.",
          "Grooming must match the outfit's colours and formality, suit the occasion, and stay within the budget band.",
          "Use practical, over-the-counter styling suggestions only. Do NOT make medical, dermatological or cosmetic-procedure claims.",
        ]
      : []),
    "Return ONLY a single valid JSON object. No markdown fences, comments, or extra text.",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalize(raw: RawLook, fallbackEventName: string): BuildYourLookData {
  const items: BuildYourLookItem[] = (raw.items ?? [])
    .filter((item) => item && item.name)
    .map((item, index) => {
      const price = Math.max(0, Math.round(item.price ?? 0));
      return {
        id: item.id ?? `item-${index}`,
        name: item.name!,
        subtitle: item.subtitle ?? "",
        description: item.description ?? "",
        brand: item.brand ?? null,
        material: item.material ?? "",
        color: item.color ?? "",
        size: item.size ?? "",
        price,
        originalPrice: Math.max(price, Math.round(item.originalPrice ?? price)),
        rating: Math.min(5, Math.max(0, Math.round((item.rating ?? 4) * 10) / 10)),
        store: item.store ?? "",
        category: CATEGORIES.includes(item.category ?? "") ? item.category! : "accessories",
        imageUrl: item.imageUrl ?? null,
      };
    });

  const originalTotal = items.reduce((sum, i) => sum + i.originalPrice, 0);
  const optimizedTotal = items.reduce((sum, i) => sum + i.price, 0);

  return {
    eventName: raw.eventName ?? fallbackEventName,
    styleName: raw.styleName ?? "Curated Look",
    styleMatch: Math.min(100, Math.max(0, Math.round(raw.styleMatch ?? 0))),
    eventMatch: Math.min(100, Math.max(0, Math.round(raw.eventMatch ?? 0))),
    originalTotal,
    optimizedTotal,
    savings: Math.max(0, originalTotal - optimizedTotal),
    items,
  };
}

function normalizeGrooming(raw: RawGrooming | undefined): GroomingPlan {
  const rawItems = Array.isArray(raw?.items) ? raw.items : [];
  const items: GroomingItem[] = rawItems
    .filter(
      (item) =>
        item &&
        GROOMING_CATEGORY_SET.has(item.category ?? "") &&
        Boolean(item.title?.trim()),
    )
    .slice(0, 6)
    .map((item) => {
      const price =
        typeof item.estimatedPriceInr === "number" &&
        Number.isFinite(item.estimatedPriceInr)
          ? Math.min(1_000_000, Math.max(0, Math.round(item.estimatedPriceInr)))
          : undefined;

      return {
        category: item.category as GroomingItem["category"],
        title: item.title!.trim(),
        why: item.why?.trim() ?? "",
        tip: item.tip?.trim() ?? "",
        ...(price !== undefined ? { estimatedPriceInr: price } : {}),
      };
    });

  if (items.length < 4) {
    throw new Error(
      "The AI returned an incomplete grooming plan. Please try again.",
    );
  }

  return {
    items,
    summary:
      raw?.summary?.trim() ||
      "Grooming suggestions chosen to match your outfit and occasion.",
  };
}

export interface GenerateLookResult {
  look: BuildYourLookData;
  grooming?: GroomingPlan;
}

export async function generateLook(
  prompt: LookPrompt,
): Promise<GenerateLookResult> {
  const includeGrooming = prompt.includeGrooming !== false;
  const fashionMemoryContext = await getFashionMemoryContext(prompt.userId);

  const raw = await aiService.generateJson<RawLook>({
    task: "build_your_look",
    instruction: baseInstruction(
      { ...prompt, includeGrooming, fashionMemoryContext },
      "Starting from scratch.",
    ),
    outputSchema: outputSchema(includeGrooming),
  });
  if (!raw.items?.length) {
    throw new Error("The AI returned an empty outfit. Please try again.");
  }

  const look = normalize(raw, prompt.eventName);
  if (!includeGrooming) return { look };

  return { look, grooming: normalizeGrooming(raw.grooming) };
}

export async function replaceItem(
  prompt: LookPrompt & {
    currentItems: BuildYourLookItem[];
    itemId: string;
    reason?: string;
  },
): Promise<BuildYourLookData> {
  const target = prompt.currentItems.find((item) => item.id === prompt.itemId);
  if (!target) throw new Error("The item to replace was not found in the current look.");

  const current = prompt.currentItems
    .map((item) => `${item.id}| ${item.name} (${item.category}, ${item.color}, ₹${item.price})`)
    .join("\n");

  const raw = await aiService.generateJson<RawLook>({
    task: "build_your_look_replace",
    instruction: [
      baseInstruction(prompt, "Swapping a single item while keeping the rest of the look intact."),
      `Replace ONLY the item with id "${prompt.itemId}" (${target.name}) with a better alternative.`,
      "Keep every other item exactly as it is (same id, name, price, etc.).",
      prompt.reason ? `Replacement goal: ${prompt.reason}` : "",
      "Return the FULL recomposed outfit (all items) in the output schema.",
      "Return ONLY a single valid JSON object. No markdown fences, comments, or extra text.",
    ]
      .filter(Boolean)
      .join("\n"),
    context: `Current outfit:\n${current}`,
    outputSchema: OUTPUT_SCHEMA,
  });
  return normalize(raw, prompt.eventName);
}

export async function addItem(
  prompt: LookPrompt & {
    currentItems: BuildYourLookItem[];
    category?: string;
    reason?: string;
  },
): Promise<BuildYourLookData> {
  const current = prompt.currentItems
    .map((item) => `${item.id}| ${item.name} (${item.category}, ${item.color}, ₹${item.price})`)
    .join("\n");

  const raw = await aiService.generateJson<RawLook>({
    task: "build_your_look_add",
    instruction: [
      "Add one more complementary item to this outfit.",
      prompt.category ? `The new item must be from this category: ${prompt.category}.` : "Pick a category that genuinely improves the look (max 7 items total).",
      "Keep all existing items EXACTLY as they are (same id, name, price, etc.).",
      "Give the new item a unique id and realistic Indian retail price under the budget.",
      prompt.reason ? `Guidance: ${prompt.reason}` : "",
      "Return the FULL recomposed outfit (all items) in the output schema.",
      "Return ONLY a single valid JSON object. No markdown fences, comments, or extra text.",
    ]
      .filter(Boolean)
      .join("\n"),
    context: `Current outfit:\n${current}`,
    outputSchema: OUTPUT_SCHEMA,
  });
  return normalize(raw, prompt.eventName);
}