import { randomUUID } from "node:crypto";
import type { CoupleStyle, EventDetails, GroupMemberProfile, Outfit, OutfitItem } from "@stylaiize/shared";
import { aiService } from "./ai.service";

export interface CoupleMemberInput {
  name: string;
  preferredColors?: string[];
}

export interface GenerateCoupleStyleInput {
  memberA: CoupleMemberInput;
  memberB: CoupleMemberInput;
  event: EventDetails;
  budget?: string;
}

function profileFor(
  input: CoupleMemberInput,
  fallbackId: string,
): GroupMemberProfile {
  return {
    id: fallbackId,
    name: input.name,
    photo: null,
    bodyAnalysis: null,
    preferredColors: input.preferredColors ?? [],
  };
}

function ensureOutfit(raw: Partial<Outfit> | undefined, index: number): Outfit {
  return {
    id: raw?.id ?? `outfit-couple-${index}`,
    name: raw?.name ?? `Coordinated Look ${index + 1}`,
    category: raw?.category ?? "party",
    items: (raw?.items ?? []).map((item) => ({
      type: item.type,
      name: item.name,
      brand: item.brand ?? null,
      color: item.color,
      price: item.price ?? null,
      currency: item.currency ?? "INR",
      buyUrl: item.buyUrl ?? null,
      imageUrl: item.imageUrl ?? null,
      reason: item.reason,
    })) as OutfitItem[],
    scores: raw?.scores ?? { fashion: 80, eventMatch: 80, comfort: 80, budget: 80 },
    totalCost: raw?.totalCost ?? null,
    explanation: raw?.explanation ?? "A coordinated look chosen to complement your partner.",
    tryOnUrl: raw?.tryOnUrl ?? null,
    createdAt: raw?.createdAt ?? new Date().toISOString(),
  };
}

export async function generateCoupleStyle(input: GenerateCoupleStyleInput): Promise<CoupleStyle> {
  const context = [
    `Event: ${input.event.name}`,
    input.event.category ? `Category: ${input.event.category}` : "",
    input.event.dressCode ? `Dress code: ${input.event.dressCode}` : "",
    input.event.venue ? `Venue: ${input.event.venue}` : "",
    `Member A: ${input.memberA.name}${input.memberA.preferredColors?.length ? ` (prefers ${input.memberA.preferredColors.join(", ")})` : ""}`,
    `Member B: ${input.memberB.name}${input.memberB.preferredColors?.length ? ` (prefers ${input.memberB.preferredColors.join(", ")})` : ""}`,
    input.budget ? `Budget: ${input.budget}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const instruction = `Create a coordinated couple outfit for an event. Return ONLY JSON with:
- memberA and memberB: { id: string, name: string, photo: null, bodyAnalysis: null, preferredColors: array of strings }
- colorPalette: { name: string, colors: array of hex strings }
- matchingOutfits: array of { person: "A" | "B", outfit: { id, name, category, items: [{ type, name, brand, color, price, currency: "INR", buyUrl, imageUrl, reason }], scores: { fashion, eventMatch, comfort, budget }, totalCost, explanation, tryOnUrl, createdAt } }
- sharedShoppingList: array of outfit items both people can use
The two looks must share a common accent palette but stay distinct per person. Use realistic Indian market prices in INR.`;

  const outputSchema = {
    memberA: { id: "string", name: "string", photo: null, bodyAnalysis: null, preferredColors: ["string"] },
    memberB: { id: "string", name: "string", photo: null, bodyAnalysis: null, preferredColors: ["string"] },
    colorPalette: { name: "string", colors: ["string"] },
    matchingOutfits: [
      { person: "A", outfit: { id: "string", name: "string", category: "string", items: [], scores: {}, totalCost: 0, explanation: "string", tryOnUrl: null, createdAt: "string" } },
    ],
    sharedShoppingList: [],
  };

  const result = await aiService.generateJson<Partial<CoupleStyle>>({
    task: "couple_style",
    instruction,
    context,
    outputSchema,
  });
  return {
    memberA: {
      ...(result.memberA ?? profileFor(input.memberA, randomUUID())),
      id: result.memberA?.id ?? randomUUID(),
      name: input.memberA.name,
      preferredColors:
        input.memberA.preferredColors && input.memberA.preferredColors.length > 0
          ? input.memberA.preferredColors
          : result.memberA?.preferredColors ?? [],
    },
    memberB: {
      ...(result.memberB ?? profileFor(input.memberB, randomUUID())),
      id: result.memberB?.id ?? randomUUID(),
      name: input.memberB.name,
      preferredColors:
        input.memberB.preferredColors && input.memberB.preferredColors.length > 0
          ? input.memberB.preferredColors
          : result.memberB?.preferredColors ?? [],
    },
    colorPalette: result.colorPalette ?? { name: "Coordinated", colors: [] },
    matchingOutfits: (result.matchingOutfits ?? []).map((m, index) => ({
      person: m.person === "B" ? "B" : "A",
      outfit: ensureOutfit(m.outfit, index),
    })),
    sharedShoppingList: (result.sharedShoppingList ?? []).map((item) => ({
      type: item.type,
      name: item.name,
      brand: item.brand ?? null,
      color: item.color,
      price: item.price ?? null,
      currency: item.currency ?? "INR",
      buyUrl: item.buyUrl ?? null,
      imageUrl: item.imageUrl ?? null,
      reason: item.reason,
    })) as OutfitItem[],
  };
}