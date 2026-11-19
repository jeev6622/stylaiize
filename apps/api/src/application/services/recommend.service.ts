import type { EventDetails, FashionMemory, RecommendationResponse, WardrobeItem } from "@stylaiize/shared";
import { OUTFIT_CATEGORIES, OUTFIT_ITEM_TYPES } from "@stylaiize/shared";
import { z } from "zod";
import { aiService } from "./ai.service";

export interface RecommendInput {
  event: EventDetails;
  wardrobeItems?: WardrobeItem[];
  fashionMemory?: FashionMemory | null;
}

const OUTFIT_CATEGORY_ENUM = [...OUTFIT_CATEGORIES] as [
  (typeof OUTFIT_CATEGORIES)[number],
  ...(typeof OUTFIT_CATEGORIES)[number][],
];
const OUTFIT_ITEM_TYPE_ENUM = [...OUTFIT_ITEM_TYPES] as [
  (typeof OUTFIT_ITEM_TYPES)[number],
  ...(typeof OUTFIT_ITEM_TYPES)[number][],
];

const ESTIMATE_NOTE =
  "Prices are rough INR estimates for styling guidance only, not live listings.";

function withEstimateNote(text: string): string {
  return /estimat|approx/i.test(text) ? text : `${text} ${ESTIMATE_NOTE}`;
}

const recommendationItemSchema = z
  .object({
    type: z.enum(OUTFIT_ITEM_TYPE_ENUM),
    name: z.string().trim().min(1).max(160),
    brand: z.literal(null).default(null),
    color: z.string().trim().min(1).max(80),
    price: z.number().finite().min(0).max(10_000_000).nullable(),
    currency: z.literal("INR"),
    buyUrl: z.literal(null).default(null),
    imageUrl: z.literal(null).default(null),
    reason: z.string().trim().min(1).max(300),
  })
  .strict();

const recommendationOutfitSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(160),
    category: z.enum(OUTFIT_CATEGORY_ENUM),
    items: z.array(recommendationItemSchema).min(3).max(7),
    scores: z
      .object({
        fashion: z.number().finite().min(0).max(100),
        eventMatch: z.number().finite().min(0).max(100),
        comfort: z.number().finite().min(0).max(100),
        budget: z.number().finite().min(0).max(100),
      })
      .strict(),
    totalCost: z.number().finite().min(0).max(100_000_000).nullable(),
    explanation: z.string().trim().min(1).max(1200).transform(withEstimateNote),
    tryOnUrl: z.literal(null).default(null),
    createdAt: z.string().trim().min(1).max(80),
  })
  .strict();

const recommendationResponseSchema = z
  .object({
    outfits: z.array(recommendationOutfitSchema).min(1).max(5),
    analysis: z.null(),
    summary: z.string().trim().min(1).max(2000).transform(withEstimateNote),
  })
  .strict();

export async function getRecommendations(input: RecommendInput): Promise<RecommendationResponse> {
  const contextParts: string[] = [];
  contextParts.push(`Event: ${input.event.name}`);
  if (input.event.category) contextParts.push(`Category: ${input.event.category}`);
  if (input.event.date) contextParts.push(`Date: ${input.event.date}`);
  if (input.event.venue) contextParts.push(`Venue: ${input.event.venue}`);
  if (input.event.dressCode) contextParts.push(`Dress code: ${input.event.dressCode}`);
  if (input.event.theme) contextParts.push(`Theme: ${input.event.theme}`);
  if (input.event.indoorOutdoor) contextParts.push(`Setting: ${input.event.indoorOutdoor}`);
  if (input.event.notes) contextParts.push(`Notes: ${input.event.notes}`);
  if (input.event.weather) {
    const w = input.event.weather;
    contextParts.push(
      `Weather (provided): ${w.condition}, ${w.temperatureC}°C${w.isRainy ? ", rainy" : ""}`,
    );
  }

  if (input.fashionMemory) {
    const memoryParts: string[] = [];
    if (input.fashionMemory.favoriteColors.length > 0) {
      memoryParts.push(`Favorite colors over time: ${input.fashionMemory.favoriteColors.join(", ")}`);
    }
    if (input.fashionMemory.favoriteBrands.length > 0) {
      memoryParts.push(`Brands the user has worn/saved before: ${input.fashionMemory.favoriteBrands.join(", ")}`);
    }
    if (input.fashionMemory.budget) {
      memoryParts.push(`Usual budget range (INR): ${input.fashionMemory.budget.min}-${input.fashionMemory.budget.max}`);
    }
    if (input.fashionMemory.previousOutfits.length > 0) {
      memoryParts.push(
        `Previously worn contexts: ${input.fashionMemory.previousOutfits.map((p) => p.eventId).join(", ")}`,
      );
    }
    if (memoryParts.length > 0) {
      contextParts.push(`\nFashion memory (prefer continuity where relevant):\n${memoryParts.join("\n")}`);
    }
  }

  if (input.wardrobeItems && input.wardrobeItems.length > 0) {
    contextParts.push("\nUser's wardrobe items (prefer reusing these):");
    for (const item of input.wardrobeItems) {
      contextParts.push(
        `- ${item.name} (${item.category}, ${item.color})${item.brand ? ` by ${item.brand}` : ""}`,
      );
    }
  }

  const instruction = `Generate 3-5 complete styling guidance outfits for this event (not live shopping listings). For each outfit, provide:
- A creative name
- A category (casual, smart_casual, formal, business, party, ethnic, beach, sport, or travel)
- 3-7 items with type, name, color, and a brief reason explaining why it suits the event and the user
- Scores for fashion, eventMatch, comfort, and budget (each 0-100)
- A rough total cost estimate in INR (sum of item estimates when provided)
- A brief explanation of why this outfit works

${input.wardrobeItems?.length ? "Prioritize reusing items from the user's wardrobe." : "Recommend styling guidance items only."}
Never invent brands, stores, ratings, review counts, image URLs, try-on URLs, or purchase links. Set brand, buyUrl, imageUrl, and tryOnUrl to null. Set analysis to null.
Prices are approximate INR planning figures only; state this in the explanation and summary.

Return ONLY a single valid JSON object. No markdown fences, comments, or extra text.`;

  const outputSchema = {
    outfits: [
      {
        id: "string",
        name: "string",
        category: "string",
        items: [
          {
            type: "string",
            name: "string",
            brand: "null",
            color: "string",
            price: "number|null (estimated INR, not a live price)",
            currency: "INR",
            buyUrl: "null",
            imageUrl: "null",
            reason: "string explaining why this suits the event",
          },
        ],
        scores: { fashion: 0, eventMatch: 0, comfort: 0, budget: 0 },
        totalCost: 0,
        explanation: "string including why it works and that prices are estimates",
        tryOnUrl: "null",
        createdAt: "ISO date string",
      },
    ],
    analysis: null,
    summary: "string",
  };

  const result = await aiService.generateJson(
    {
      task: "recommend_outfits",
      instruction,
      context: contextParts.join("\n"),
      outputSchema,
    },
    recommendationResponseSchema,
  );
  return result;
}
