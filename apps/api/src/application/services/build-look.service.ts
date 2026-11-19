import type {
  BuildYourLookData,
  BuildYourLookItem,
  GroomingItem,
  GroomingPlan,
  ShopAudience,
  StyleProfile,
} from "@stylaiize/shared";
import { BUILD_LOOK_CATEGORIES, GROOMING_CATEGORIES } from "@stylaiize/shared";
import { z } from "zod";
import { aiService } from "@/application/services/ai.service";
import * as memoryService from "./memory.service";

const CATEGORIES = [...BUILD_LOOK_CATEGORIES] as [
  (typeof BUILD_LOOK_CATEGORIES)[number],
  ...(typeof BUILD_LOOK_CATEGORIES)[number][],
];
const GROOMING_CATEGORY_ENUM = [...GROOMING_CATEGORIES] as [
  (typeof GROOMING_CATEGORIES)[number],
  ...(typeof GROOMING_CATEGORIES)[number][],
];

const BUDGET_LABEL: Record<string, string> = {
  "2000": "up to ₹2,000",
  "5000": "up to ₹5,000",
  "10000": "up to ₹10,000",
  premium: "premium (₹10,000+ guidance, no fixed upper cap)",
};

interface LookPrompt {
  eventName: string;
  audience: ShopAudience;
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
  weather?: { condition: string; temperatureC: number; isRainy: boolean } | null;
  fashionMemoryContext?: string;
  userId?: string;
}

type WeatherInfo = NonNullable<LookPrompt["weather"]>;

const lookItemSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(160),
    subtitle: z.string().trim().max(200),
    description: z.string().trim().min(1).max(500),
    material: z.string().trim().max(120),
    color: z.string().trim().min(1).max(80),
    size: z.string().trim().max(40),
    category: z.enum(CATEGORIES),
  })
  .strict();

const groomingItemSchema = z
  .object({
    category: z.enum(GROOMING_CATEGORY_ENUM),
    title: z.string().trim().min(1).max(160),
    why: z.string().trim().min(1).max(500),
    tip: z.string().trim().min(1).max(500),
    estimatedPriceInr: z
      .number()
      .finite()
      .min(0)
      .max(1_000_000)
      .optional(),
  })
  .strict();

const groomingSchema = z
  .object({
    summary: z.string().trim().min(1).max(400),
    items: z.array(groomingItemSchema).min(4).max(6),
  })
  .strict();

const lookBaseSchema = z
  .object({
    eventName: z.string().trim().min(1).max(160),
    styleName: z.string().trim().min(1).max(160),
    styleMatch: z.number().finite().min(0).max(100),
    eventMatch: z.number().finite().min(0).max(100),
    colorCombination: z.string().trim().min(1).max(300),
    footwear: z.string().trim().min(1).max(300),
    accessories: z.array(z.string().trim().min(1).max(160)).min(1).max(8),
    explanation: z.string().trim().min(1).max(1200),
    weatherNote: z.string().trim().min(1).max(300).nullable().optional(),
    dressCode: z.string().trim().max(120).nullable().optional(),
    dressCodeReason: z.string().trim().max(500).nullable().optional(),
    recommendedColors: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
    fitGuidance: z.string().trim().max(400).nullable().optional(),
    accessoryGuidance: z.string().trim().max(400).nullable().optional(),
    groomingGuidance: z.string().trim().max(400).nullable().optional(),
    occasionSuitability: z.string().trim().max(400).nullable().optional(),
    seasonSuitability: z.string().trim().max(400).nullable().optional(),
    shoppingQueries: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
    items: z.array(lookItemSchema).min(4).max(7),
  })
  .strict();

const lookSchema = lookBaseSchema.extend({ grooming: groomingSchema }).strict();
const lookWithoutGroomingSchema = lookBaseSchema.strict();

const ITEM_OUTPUT_SCHEMA = {
  id: "string (unique)",
  name: "string (clothing item name/description)",
  subtitle: "string (short style subtitle)",
  description: "string (styling guidance for this piece)",
  material: "string",
  color: "string",
  size: "string (guidance, e.g. regular/tailored/one size)",
  category: "one of upperwear | lowerwear | footwear | accessories",
};

const LOOK_OUTPUT_SCHEMA: Record<string, unknown> = {
  eventName: "string",
  styleName: "string",
  styleMatch: "number 0-100",
  eventMatch: "number 0-100",
  colorCombination: "string (how the colours work together)",
  footwear: "string (footwear direction for the complete look)",
  accessories: ["string (accessory direction items)"],
  explanation: "string (why this styling direction works)",
  weatherNote: "string or null (only when real weather context is provided)",
  dressCode: "string (e.g. Smart Casual, Business Casual, Formal, Streetwear, Party Wear, Wedding Guest, Traditional, Minimalist, Old Money, Athleisure)",
  dressCodeReason: "string (why this dress code suits the occasion)",
  recommendedColors: ["string (recommended colour or combination)"],
  fitGuidance: "string (recommended fit and clothing style)",
  accessoryGuidance: "string (grooming and accessory suggestions)",
  groomingGuidance: "string (concise grooming direction)",
  occasionSuitability: "string (why the look suits the occasion)",
  seasonSuitability: "string (why the look suits the provided season, or state that no season was provided)",
  shoppingQueries: ["string (neutral shopping search phrase only; no brands, prices, URLs or stock)"],
  items: [ITEM_OUTPUT_SCHEMA],
};

const GROOMING_OUTPUT_SCHEMA = {
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
    ? { ...LOOK_OUTPUT_SCHEMA, grooming: GROOMING_OUTPUT_SCHEMA }
    : LOOK_OUTPUT_SCHEMA;
}

function budgetSentence(budget: string): string {
  return BUDGET_LABEL[budget] ?? BUDGET_LABEL["premium"];
}

function budgetToEstimate(budget: string): { min: number; max: number | null; currency: "INR" } {
  switch (budget) {
    case "2000":
      return { min: 0, max: 2000, currency: "INR" };
    case "5000":
      return { min: 0, max: 5000, currency: "INR" };
    case "10000":
      return { min: 0, max: 10000, currency: "INR" };
    case "premium":
    default:
      return { min: 10000, max: null, currency: "INR" };
  }
}

function weatherSentence(weather: WeatherInfo | null | undefined): string {
  if (!weather) return "";
  const rain = weather.isRainy ? ", rainy" : "";
  return `Real weather context (provided by client): ${weather.condition}, ${weather.temperatureC}°C${rain}.`;
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
    return undefined;
  }
}

function baseInstruction(prompt: LookPrompt, focus: string): string {
  const hasWeather = Boolean(prompt.weather);
  return [
    `Create complete, polished styling guidance for one person for this event. ${focus}`,
    `Event name: ${prompt.eventName}`,
    `Audience: ${prompt.audience}. Use only garments appropriate for this audience.`,
    prompt.occasion ? `Occasion/event type: ${prompt.occasion}` : "",
    prompt.dressCode ? `Dress code: ${prompt.dressCode}` : "",
    `Style: ${prompt.style}`,
    `Budget band (guidance only): ${budgetSentence(prompt.budget)}`,
    prompt.colors?.length ? `Preferred colors: ${prompt.colors.join(", ")}` : "",
    prompt.fit ? `Fit preference: ${prompt.fit}` : "",
    prompt.brand ? `Style/brand direction: ${prompt.brand}` : "",
    prompt.season ? `Season: ${prompt.season}` : "",
    weatherSentence(prompt.weather),
    prompt.styleProfile ? styleProfileSentence(prompt.styleProfile) : "",
    prompt.fashionMemoryContext
      ? `Fashion memory (reuse what already works for this person): ${prompt.fashionMemoryContext}`
      : "",
    "Show a clear dressCode and explain in dressCodeReason why it suits the occasion.",
    "Include recommendedColors, fitGuidance, accessoryGuidance, groomingGuidance, occasionSuitability and seasonSuitability.",
    "If no season was provided, say so plainly in seasonSuitability instead of inventing one.",
    "Generate shoppingQueries as neutral search phrases derived from the outfit. They must not contain prices, ratings, retailer names, URLs or stock claims.",
    "Return STYLING GUIDANCE only. Describe clothing pieces and styling direction; do NOT invent purchasable products.",
    "Do NOT include brand, store, rating, imageUrl, price, originalPrice, discount, buyUrl, stock, or availability for any item.",
    "Include at least 4 and at most 7 items: at least one upperwear, one lowerwear, one footwear, and one accessory category item.",
    "Provide colorCombination, footwear direction, accessories direction, and an explanation of the styling choices.",
    hasWeather
      ? "Set weatherNote to a short note explaining how the look suits the provided weather. Do not infer weather beyond the provided context."
      : "Set weatherNote to null. Do not infer weather from date, location, or season.",
    ...(prompt.includeGrooming
      ? [
          "Also return a grooming plan with 4-6 items covering hair, facial grooming, skin prep, accessories and fragrance.",
          "Grooming must match the outfit's colours and formality, suit the occasion, and stay within the budget band.",
          "Use practical, over-the-counter styling suggestions only. Do NOT make medical, dermatological or cosmetic-procedure claims.",
        ]
      : []),
    "Return ONLY a single valid JSON object. No markdown fences, comments, or extra text.",
  ]
    .filter(Boolean)
    .join("\n");
}

type ParsedLookBase = z.infer<typeof lookBaseSchema>;

function normalizeItem(raw: z.infer<typeof lookItemSchema>, index: number): BuildYourLookItem {
  return {
    id: raw.id || `item-${index + 1}`,
    name: raw.name,
    subtitle: raw.subtitle ?? "",
    description: raw.description,
    brand: null,
    material: raw.material ?? "",
    color: raw.color,
    size: raw.size ?? "",
    price: 0,
    originalPrice: 0,
    rating: 0,
    store: "",
    category: raw.category,
    imageUrl: null,
  };
}

function normalizeLook(raw: ParsedLookBase, prompt: LookPrompt): BuildYourLookData {
  const items = raw.items.map((item, index) => normalizeItem(item, index));
  const hasWeather = Boolean(prompt.weather);
  const generatedQueries =
    raw.shoppingQueries.length > 0
      ? raw.shoppingQueries
      : items
          .slice(0, 10)
          .map((item) => `${item.category} ${item.name} ${item.color}`.trim());

  return {
    eventName: raw.eventName || prompt.eventName,
    audience: prompt.audience,
    styleName: raw.styleName,
    styleMatch: Math.min(100, Math.max(0, Math.round(raw.styleMatch))),
    eventMatch: Math.min(100, Math.max(0, Math.round(raw.eventMatch))),
    estimatedBudgetInr: budgetToEstimate(prompt.budget),
    colorCombination: raw.colorCombination,
    footwear: raw.footwear,
    accessories: raw.accessories.map((a) => a.trim()).filter(Boolean),
    explanation: raw.explanation,
    ...(hasWeather && raw.weatherNote ? { weatherNote: raw.weatherNote } : {}),
    dressCode: raw.dressCode || prompt.dressCode || raw.styleName,
    dressCodeReason: raw.dressCodeReason || raw.explanation,
    recommendedColors: raw.recommendedColors,
    fitGuidance: raw.fitGuidance,
    accessoryGuidance:
      raw.accessoryGuidance || (raw.accessories.length ? raw.accessories.join(", ") : null),
    groomingGuidance: raw.groomingGuidance,
    occasionSuitability:
      raw.occasionSuitability || prompt.occasion || prompt.eventName,
    seasonSuitability:
      raw.seasonSuitability ||
      (prompt.season
        ? `Selected season: ${prompt.season}.`
        : "No season was provided for this look."),
    shoppingQueries: generatedQueries,
    originalTotal: 0,
    optimizedTotal: 0,
    savings: 0,
    items,
  };
}

function normalizeGrooming(raw: z.infer<typeof groomingSchema>): GroomingPlan {
  return {
    items: raw.items.map((item) => {
      const base: GroomingItem = {
        category: item.category,
        title: item.title,
        why: item.why,
        tip: item.tip,
      };
      if (typeof item.estimatedPriceInr === "number" && Number.isFinite(item.estimatedPriceInr)) {
        base.estimatedPriceInr = Math.max(0, Math.round(item.estimatedPriceInr));
      }
      return base;
    }),
    summary: raw.summary,
  };
}

export interface GenerateLookResult {
  look: BuildYourLookData;
  grooming?: GroomingPlan;
}

export async function generateLook(prompt: LookPrompt): Promise<GenerateLookResult> {
  const includeGrooming = prompt.includeGrooming !== false;
  const fashionMemoryContext = await getFashionMemoryContext(prompt.userId);

  if (includeGrooming) {
    const raw = await aiService.generateJson(
      {
        task: "build_your_look",
        instruction: baseInstruction(
          { ...prompt, includeGrooming, fashionMemoryContext },
          "Starting from scratch.",
        ),
        outputSchema: outputSchema(true),
      },
      lookSchema,
    );
    return {
      look: normalizeLook(raw, prompt),
      grooming: normalizeGrooming(raw.grooming),
    };
  }

  const raw = await aiService.generateJson(
    {
      task: "build_your_look",
      instruction: baseInstruction(
        { ...prompt, includeGrooming, fashionMemoryContext },
        "Starting from scratch.",
      ),
      outputSchema: outputSchema(false),
    },
    lookWithoutGroomingSchema,
  );
  return { look: normalizeLook(raw, prompt) };
}

function currentItemsContext(items: BuildYourLookItem[]): string {
  return items
    .map(
      (item) =>
        `${item.id} | ${item.name} (${item.category}, ${item.color}) - ${item.description}`,
    )
    .join("\n");
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

  const raw = await aiService.generateJson(
    {
      task: "build_your_look_replace",
      instruction: [
        baseInstruction(prompt, "Swapping a single item while keeping the rest of the look coherent."),
        `Replace ONLY the item with id "${prompt.itemId}" (${target.name}) with a better styling alternative.`,
        "Keep every other item's id, name, category, and overall intent unchanged unless minor description tweaks are needed for coherence.",
        prompt.reason ? `Replacement goal: ${prompt.reason}` : "",
        "Return the FULL recomposed outfit (all items) in the output schema.",
        "Return ONLY a single valid JSON object. No markdown fences, comments, or extra text.",
      ]
        .filter(Boolean)
        .join("\n"),
      context: `Current outfit:\n${currentItemsContext(prompt.currentItems)}`,
      outputSchema: LOOK_OUTPUT_SCHEMA,
    },
    lookBaseSchema,
  );
  return normalizeLook(raw, prompt);
}

export async function addItem(
  prompt: LookPrompt & {
    currentItems: BuildYourLookItem[];
    category?: string;
    reason?: string;
  },
): Promise<BuildYourLookData> {
  const raw = await aiService.generateJson(
    {
      task: "build_your_look_add",
      instruction: [
        baseInstruction(prompt, "Adding one complementary item to this outfit."),
        prompt.category
          ? `The new item must be from this category: ${prompt.category}.`
          : "Pick a category that genuinely improves the look (max 7 items total).",
        "Keep all existing items' ids, names, categories, and overall intent exactly as they are.",
        "Give the new item a unique id.",
        prompt.reason ? `Guidance: ${prompt.reason}` : "",
        "Return the FULL recomposed outfit (all items) in the output schema.",
        "Return ONLY a single valid JSON object. No markdown fences, comments, or extra text.",
      ]
        .filter(Boolean)
        .join("\n"),
      context: `Current outfit:\n${currentItemsContext(prompt.currentItems)}`,
      outputSchema: LOOK_OUTPUT_SCHEMA,
    },
    lookBaseSchema,
  );
  return normalizeLook(raw, prompt);
}