/**
 * Builds the personalised context block injected into AI chat prompts.
 *
 * Without this the model knows nothing about the user: which clothes they
 * already own, what they like, their sizes, or their budget. Everything here
 * is read from the database — nothing is invented.
 */
import type { FashionMemory, WardrobeItem } from "@stylaiize/shared";
import { wardrobeRepository } from "@/infrastructure/repos/wardrobe.repo";
import { getMemory } from "@/application/services/memory.service";
import { userRepository } from "@/infrastructure/repos/user.repo";

/** Cap how many wardrobe pieces are listed so prompts stay a sane size. */
const MAX_WARDROBE_ITEMS = 60;

function line(label: string, value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `${label}: ${value}`;
}

function describeWardrobe(items: WardrobeItem[]): string {
  if (items.length === 0) return "";
  const byCategory = new Map<string, number>();
  for (const item of items) {
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
  }
  const summary = [...byCategory.entries()]
    .map(([category, count]) => `${category} (${count})`)
    .join(", ");

  const listing = items
    .slice(0, MAX_WARDROBE_ITEMS)
    .map((i) => {
      const bits = [i.name, i.color, i.brand].filter(Boolean).join(" / ");
      return `- [${i.category}] ${bits}`;
    })
    .join("\n");

  return [
    line("Wardrobe item count", items.length),
    `Wardrobe by category: ${summary}`,
    "Items the user already owns:",
    listing,
  ]
    .filter(Boolean)
    .join("\n");
}

function describeMemory(memory: FashionMemory): string {
  const parts = [
    line("Favorite colors", memory.favoriteColors.join(", ")),
    line("Favorite brands", memory.favoriteBrands.join(", ")),
    line("Typical budget (INR)", memory.budget ? `${memory.budget.min} - ${memory.budget.max}` : null),
    line("Known sizes", Object.entries(memory.sizes).map(([k, v]) => `${k}=${v}`).join(", ")),
    line("Events attended", memory.attendedEvents.slice(-5).join("; ")),
    line("Outfits worn before", memory.previousOutfits.length),
  ].filter(Boolean);
  return parts.join("\n");
}

/**
 * A compact, factual profile of the user for the stylist prompt.
 * Returns an empty string for anonymous chat (no user on the request).
 */
export async function buildUserContext(userId: string | null): Promise<string> {
  if (!userId) return "";

  const [user, items, memory] = await Promise.all([
    userRepository()
      .findById(userId)
      .catch(() => null),
    wardrobeRepository()
      .findByUserId(userId)
      .catch(() => [] as WardrobeItem[]),
    getMemory(userId).catch(() => null),
  ]);

  const profile = [
    line("Name", user?.name),
    line("Gender", user?.gender),
    line("Style preferences", user?.preferences.stylePreferences.join(", ")),
    line(
      "Budget range (INR)",
      user?.preferences.budgetRange
        ? `${user.preferences.budgetRange.min} - ${user.preferences.budgetRange.max}`
        : null,
    ),
    line("Favorite colors", user?.preferences.favoriteColors.join(", ")),
    line("Favorite brands", user?.preferences.favoriteBrands.join(", ")),
  ].filter(Boolean);

  const blocks = [
    profile.length > 0 ? `About the user:\n${profile.join("\n")}` : "",
    describeWardrobe(items),
    memory ? describeMemory(memory) : "",
  ].filter(Boolean);

  return blocks.join("\n\n");
}
