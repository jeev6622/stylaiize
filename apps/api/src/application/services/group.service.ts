import { randomUUID } from "node:crypto";
import type { EventDetails, GroupMemberProfile, GroupStyle, Outfit, OutfitItem } from "@stylaiize/shared";
import { aiService } from "./ai.service";

export interface GroupMemberInput {
  name: string;
  preferredColors?: string[];
}

export interface GenerateGroupStyleInput {
  members: GroupMemberInput[];
  event: EventDetails;
  budget?: string;
  nightlife?: boolean;
  weddingDressCode?: string;
}

function profileFor(input: GroupMemberInput, _index: number): GroupMemberProfile {
  return {
    id: randomUUID(),
    name: input.name,
    photo: null,
    bodyAnalysis: null,
    preferredColors: input.preferredColors ?? [],
  };
}

function ensureOutfit(raw: Partial<Outfit> | undefined, index: number): Outfit {
  return {
    id: raw?.id ?? `outfit-group-${index}`,
    name: raw?.name ?? `Group Look ${index + 1}`,
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
    explanation: raw?.explanation ?? "A coordinated look that stays distinct within the group.",
    tryOnUrl: raw?.tryOnUrl ?? null,
    createdAt: raw?.createdAt ?? new Date().toISOString(),
  };
}

export async function generateGroupStyle(input: GenerateGroupStyleInput): Promise<GroupStyle> {
  const membersText = input.members
    .map(
      (m, index) =>
        `Member ${index + 1}: ${m.name}${m.preferredColors?.length ? ` (prefers ${m.preferredColors.join(", ")})` : ""}`,
    )
    .join("\n");

  const context = [
    `Event: ${input.event.name}`,
    input.event.category ? `Category: ${input.event.category}` : "",
    input.event.dressCode ? `Dress code: ${input.event.dressCode}` : "",
    input.event.venue ? `Venue: ${input.event.venue}` : "",
    membersText,
    input.budget ? `Budget: ${input.budget}` : "",
    input.weddingDressCode ? `Wedding dress code: ${input.weddingDressCode}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const instruction = `Create a coordinated group wardrobe for an event. Return ONLY JSON with:
- members: array of { id, name, photo: null, bodyAnalysis: null, preferredColors: array of strings }
- colorPalette: { name: string, colors: array of hex strings }
- theme: string
- outfits: array of { memberId: string, outfit: { id, name, category, items: [{ type, name, brand, color, price, currency: "INR", buyUrl, imageUrl, reason }], scores: { fashion, eventMatch, comfort, budget }, totalCost, explanation, tryOnUrl, createdAt } }
- shoppingList: array of outfit items the group can share
Each member's look must be distinct but all must sit on the same shared palette. Use realistic Indian market prices in INR.`;

  const outputSchema = {
    members: [{ id: "string", name: "string", photo: null, bodyAnalysis: null, preferredColors: ["string"] }],
    colorPalette: { name: "string", colors: ["string"] },
    theme: "string",
    outfits: [{ memberId: "string", outfit: { id: "string", name: "string", category: "string", items: [], scores: {}, totalCost: 0, explanation: "string", tryOnUrl: null, createdAt: "string" } }],
    shoppingList: [],
  };

  const result = await aiService.generateJson<Partial<GroupStyle>>({
    task: "group_style",
    instruction,
    context,
    outputSchema,
  });
  const members =
    result.members && result.members.length === input.members.length
      ? result.members.map((m, index) => ({
          ...m,
          id: m.id ?? profileFor(input.members[index], index).id,
          name: input.members[index].name,
          preferredColors:
            input.members[index].preferredColors &&
            input.members[index].preferredColors.length > 0
              ? input.members[index].preferredColors
              : m.preferredColors ?? [],
        }))
      : input.members.map((m, index) => profileFor(m, index));

  const outfitByMember = new Map((result.outfits ?? []).map((o, index) => [o.memberId ?? `candidate-${index}`, o]));

  return {
    members,
    colorPalette: result.colorPalette ?? { name: "Coordinated", colors: [] },
    theme: result.theme ?? "A single shared palette with individual variation.",
    outfits: members.map((member, index) => ({
      memberId: member.id,
      outfit: ensureOutfit(outfitByMember.get(member.id)?.outfit ?? outfitByMember.get(`candidate-${index}`)?.outfit, index),
    })),
    shoppingList: (result.shoppingList ?? []).map((item) => ({
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