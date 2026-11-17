import type { FashionMemory, RecommendationResponse, WardrobeItem } from "@stylaiize/shared";
import { aiService } from "./ai.service";
import type { EventDetails } from "@stylaiize/shared";

export interface RecommendInput {
  event: EventDetails;
  wardrobeItems?: WardrobeItem[];
  fashionMemory?: FashionMemory | null;
}

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
      contextParts.push(`- ${item.name} (${item.category}, ${item.color})${item.brand ? ` by ${item.brand}` : ""}`);
    }
  }

  const instruction = `Generate 3-5 complete outfit recommendations for this event. For each outfit, provide:
- A creative name
- A category (casual, smart_casual, formal, business, party, ethnic, beach, sport, or travel)
- 3-7 items with type, name, brand, color, price (INR), and a brief reason for each
- Scores for fashion, eventMatch, comfort, and budget (each 0-100)
- A total estimated cost in INR
- A brief explanation of why this outfit works

${input.wardrobeItems?.length ? "Prioritize reusing items from the user's wardrobe. Mark wardrobe items with their original brand if available." : "Recommend new purchases with specific product suggestions."}

Use realistic Indian market prices in INR.`;

  const outputSchema = {
    outfits: [{
      id: "string",
      name: "string",
      category: "string",
      items: [{
        type: "string",
        name: "string",
        brand: "string|null",
        color: "string",
        price: "number|null",
        currency: "INR",
        buyUrl: "null",
        imageUrl: "null",
        reason: "string",
      }],
      scores: { fashion: 0, eventMatch: 0, comfort: 0, budget: 0 },
      totalCost: 0,
      explanation: "string",
      tryOnUrl: "null",
      createdAt: "ISO date string",
    }],
    analysis: null,
    summary: "string",
  };

  try {
    const result = await aiService.generateJson<RecommendationResponse>({
      task: "recommend_outfits",
      instruction,
      context: contextParts.join("\n"),
      outputSchema,
    });
    return result;
  } catch {
    const messages = [{ role: "user" as const, content: contextParts.join("\n") }];
    const res = await aiService.chat({ messages });
    return {
      outfits: [],
      analysis: null,
      summary: res.text,
    };
  }
}
