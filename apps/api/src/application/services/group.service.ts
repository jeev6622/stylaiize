import { randomUUID } from "node:crypto";
import type { EventDetails, GroupMemberProfile, GroupStyle, Outfit, OutfitItem } from "@stylaiize/shared";
import { OUTFIT_CATEGORIES, OUTFIT_ITEM_TYPES } from "@stylaiize/shared";
import { z } from "zod";
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

const itemSchema = z
  .object({
    type: z.enum(OUTFIT_ITEM_TYPE_ENUM),
    name: z.string().trim().min(1).max(160),
    brand: z.literal(null).default(null),
    color: z.string().trim().min(1).max(80),
    price: z.number().finite().min(0).max(10_000_000).nullable().default(null),
    currency: z.literal("INR"),
    buyUrl: z.literal(null).default(null),
    imageUrl: z.literal(null).default(null),
    reason: z.string().trim().min(1).max(300),
  })
  .strict();

const outfitSchema = z
  .object({
    id: z.string().trim().min(1).max(120).optional(),
    name: z.string().trim().min(1).max(160),
    category: z.enum(OUTFIT_CATEGORY_ENUM),
    items: z.array(itemSchema).min(1).max(10),
    scores: z
      .object({
        fashion: z.number().finite().min(0).max(100),
        eventMatch: z.number().finite().min(0).max(100),
        comfort: z.number().finite().min(0).max(100),
        budget: z.number().finite().min(0).max(100),
      })
      .strict()
      .optional(),
    totalCost: z.number().finite().min(0).max(100_000_000).nullable().optional(),
    explanation: z.string().trim().min(1).max(1200).transform(withEstimateNote),
    tryOnUrl: z.literal(null).default(null),
    createdAt: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

const memberSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(120),
    photo: z.literal(null).default(null),
    bodyAnalysis: z.literal(null).default(null),
    preferredColors: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  })
  .strict();

const groupStyleSchema = z
  .object({
    members: z.array(memberSchema).min(1).max(20),
    colorPalette: z
      .object({
        name: z.string().trim().min(1).max(120),
        colors: z.array(z.string().trim().min(1).max(40)).max(12),
      })
      .strict(),
    theme: z.string().trim().min(1).max(300),
    outfits: z
      .array(
        z
          .object({
            memberId: z.string().trim().min(1).max(120),
            outfit: outfitSchema,
          })
          .strict(),
      )
      .max(20),
    shoppingList: z.array(itemSchema).max(30),
  })
  .strict();

function profileFor(input: GroupMemberInput, _index: number): GroupMemberProfile {
  return {
    id: randomUUID(),
    name: input.name,
    photo: null,
    bodyAnalysis: null,
    preferredColors: input.preferredColors ?? [],
  };
}

function toItem(item: z.infer<typeof itemSchema>): OutfitItem {
  return {
    type: item.type,
    name: item.name,
    brand: null,
    color: item.color,
    price: item.price,
    currency: "INR",
    buyUrl: null,
    imageUrl: null,
    reason: item.price === null ? item.reason : withEstimateNote(item.reason),
  };
}

function ensureOutfit(raw: z.infer<typeof outfitSchema> | undefined, index: number): Outfit {
  return {
    id: raw?.id ?? `outfit-group-${index}`,
    name: raw?.name ?? `Group Look ${index + 1}`,
    category: raw?.category ?? "party",
    items: (raw?.items ?? []).map(toItem),
    scores: raw?.scores ?? { fashion: 80, eventMatch: 80, comfort: 80, budget: 80 },
    totalCost: raw?.totalCost ?? null,
    explanation: raw?.explanation ?? "A coordinated look that stays distinct within the group.",
    tryOnUrl: null,
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

  const instruction = `Create a coordinated group styling plan for an event (guidance only, never live shopping listings). Return ONLY JSON with:
- members: array of { id, name, photo: null, bodyAnalysis: null, preferredColors: array of strings }
- colorPalette: { name: string, colors: array of hex strings }
- theme: string
- outfits: array of { memberId: string, outfit: { id, name, category, items: [{ type, name, brand: null, color, price: number|null, currency: "INR", buyUrl: null, imageUrl: null, reason }], scores: { fashion, eventMatch, comfort, budget }, totalCost, explanation, tryOnUrl: null, createdAt } }
- shoppingList: array of styling guidance items the group can share, with the same item shape
Keep a brief "why it suits you" reason on every item. Never invent brands, stores, ratings, review counts, image URLs, try-on URLs, or purchase links. Prices are approximate INR planning figures; say so in explanations.

Return ONLY a single valid JSON object. No markdown fences, comments, or extra text.`;

  const outputSchema = {
    members: [{ id: "string", name: "string", photo: null, bodyAnalysis: null, preferredColors: ["string"] }],
    colorPalette: { name: "string", colors: ["string"] },
    theme: "string",
    outfits: [
      {
        memberId: "string",
        outfit: {
          id: "string",
          name: "string",
          category: "string",
          items: [{ type: "string", name: "string", brand: null, color: "string", price: "number|null", currency: "INR", buyUrl: null, imageUrl: null, reason: "why it suits the wearer" }],
          scores: { fashion: 0, eventMatch: 0, comfort: 0, budget: 0 },
          totalCost: "number|null",
          explanation: "string including that prices are estimates",
          tryOnUrl: null,
          createdAt: "ISO date string",
        },
      },
    ],
    shoppingList: [],
  };

  const result = await aiService.generateJson(
    {
      task: "group_style",
      instruction,
      context,
      outputSchema,
    },
    groupStyleSchema,
  );
  const members =
    result.members.length === input.members.length
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

  const outfitByMember = new Map(result.outfits.map((o, index) => [o.memberId ?? `candidate-${index}`, o]));

  return {
    members,
    colorPalette: result.colorPalette,
    theme: result.theme,
    outfits: members.map((member, index) => ({
      memberId: member.id,
      outfit: ensureOutfit(outfitByMember.get(member.id)?.outfit ?? outfitByMember.get(`candidate-${index}`)?.outfit, index),
    })),
    shoppingList: result.shoppingList.map(toItem),
  };
}
