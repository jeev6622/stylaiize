import { randomUUID } from "node:crypto";
import { packingListRepository } from "@/infrastructure/repos/packing.repo";
import type { CreatePackingListInput } from "@/domain/ports/repositories";
import { PACKING_CATEGORIES } from "@stylaiize/shared";
import type { PackingList, PackingItem, PackingCategory } from "@stylaiize/shared";
import { z } from "zod";
import { NotFoundError } from "@/utils/errors";
import { aiService } from "@/application/services/ai.service";

export async function createList(input: CreatePackingListInput): Promise<PackingList> {
  return packingListRepository().create(input);
}

export async function getLists(userId: string): Promise<PackingList[]> {
  return packingListRepository().findByUserId(userId);
}

export async function getList(userId: string, listId: string): Promise<PackingList> {
  if (!userId) throw new NotFoundError("Packing list not found.");
  const list = await packingListRepository().findByIdAndUserId(listId, userId);
  if (!list) throw new NotFoundError("Packing list not found.");
  return list;
}

export async function updateList(
  userId: string,
  listId: string,
  patch: Partial<Pick<PackingList, "title" | "destination" | "startDate" | "endDate" | "items" | "weatherBasedAdjustments" | "activities">>,
): Promise<PackingList> {
  if (!userId) throw new NotFoundError("Packing list not found.");
  const existing = await packingListRepository().findByIdAndUserId(listId, userId);
  if (!existing) throw new NotFoundError("Packing list not found.");
  const updated = await packingListRepository().update(listId, patch);
  if (!updated) throw new NotFoundError("Packing list not found.");
  return updated;
}

export async function deleteList(userId: string, listId: string): Promise<void> {
  if (!userId) throw new NotFoundError("Packing list not found.");
  const existing = await packingListRepository().findByIdAndUserId(listId, userId);
  if (!existing) throw new NotFoundError("Packing list not found.");
  await packingListRepository().delete(listId);
}

const PACKING_CATEGORY_ENUM = [...PACKING_CATEGORIES] as [
  PackingCategory,
  ...PackingCategory[],
];

const generatedPackingSchema = z.object({
  title: z.string().trim().min(1).max(160).default("Packing list"),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        category: z.enum(PACKING_CATEGORY_ENUM),
        quantity: z.number().int().min(1).max(99).default(1),
        essential: z.boolean().default(false),
      }),
    )
    .max(100)
    .default([]),
  weatherBasedAdjustments: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
});

export async function generatePackingList(
  userId: string,
  destination: string,
  startDate: string | null,
  endDate: string | null,
  activities: string[],
): Promise<PackingList> {
  const title = `Trip to ${destination}`;

  const daysCount =
    startDate && endDate
      ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
      : 5;

  const context = [
    `Destination: ${destination}`,
    `Duration: ${daysCount} days`,
    activities.length > 0 ? `Activities: ${activities.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await aiService.generateJson(
    {
      task: "packing_list",
      instruction: `Generate a comprehensive packing list for a trip. Return a JSON object with:
          - title: a short descriptive title for the trip
          - items: array of items, each with name (string), category (one of: clothing, shoes, accessories, toiletries, tech, documents, misc), quantity (number), essential (boolean)
          - weatherBasedAdjustments: array of string suggestions for weather-appropriate packing
          Include enough items for the trip duration and activities. Make items practical and specific.`,
      context,
      outputSchema: {
        title: "string",
        items: [
          { name: "string", category: "clothing", quantity: 1, essential: true },
        ],
        weatherBasedAdjustments: ["string"],
      },
    },
    generatedPackingSchema,
  );

  const items: PackingItem[] = (result.items ?? []).map((item) => ({
    id: randomUUID(),
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    essential: item.essential ?? false,
    packed: false,
  }));

  const list = await packingListRepository().create({
    userId,
    title: result.title ?? title,
    destination,
    startDate,
    endDate,
  });

  await packingListRepository().update(list.id, {
    items,
    weatherBasedAdjustments: result.weatherBasedAdjustments ?? [],
    activities,
  });

  return (await packingListRepository().findById(list.id))!;
}
