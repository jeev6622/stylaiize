import type { BuildYourLookData, BuildYourLookItem } from "@stylaiize/shared";
import type { OutfitData, OutfitItem } from "@/components/build-look/types";

/**
 * Anchor points on the 3D model where each garment category's hotspot sits.
 * Vectors are in model space: x = left/right, y = height, z = toward camera.
 */
const CATEGORY_ANCHORS: Record<string, [number, number, number]> = {
  upperwear: [-0.4, 1.45, 0.22],
  lowerwear: [0.0, 0.6, 0.3],
  footwear: [0.16, 0.02, 0.26],
  accessories: [-0.5, 1.05, 0.2],
};

const FALLBACK_ANCHOR: [number, number, number] = [0.32, 1.15, 0.24];

/**
 * Nudges each hotspot sideways so multiple pieces in the same category do not
 * stack on top of one another in the 3D scene.
 */
function anchorFor(category: string, indexWithinCategory: number): [number, number, number] {
  const base = CATEGORY_ANCHORS[category] ?? FALLBACK_ANCHOR;
  const spread = (indexWithinCategory % 3) - 1;
  return [base[0] + spread * 0.12, base[1] + spread * 0.05, base[2]];
}

export function toOutfitItem(item: BuildYourLookItem, index: number, order: number): OutfitItem {
  return {
    id: item.id,
    index,
    name: item.name,
    subtitle: item.subtitle,
    description: item.description,
    price: item.price,
    brand: item.brand ?? "",
    material: item.material,
    color: item.color,
    size: item.size,
    rating: item.rating,
    store: item.store,
    imageUrl: item.imageUrl,
    hotspotPosition: anchorFor(item.category, order),
    category: item.category,
  };
}

export function toOutfitData(look: BuildYourLookData): OutfitData {
  const perCategoryOrder = new Map<string, number>();
  const items = look.items.map((item, index) => {
    const order = perCategoryOrder.get(item.category) ?? 0;
    perCategoryOrder.set(item.category, order + 1);
    return toOutfitItem(item, index, order);
  });

  return {
    eventName: look.eventName,
    styleName: look.styleName,
    styleMatch: look.styleMatch,
    eventMatch: look.eventMatch,
    items,
    originalTotal: look.originalTotal,
    optimizedTotal: look.optimizedTotal,
    savings: look.savings,
  };
}

/** Strips 3D-only fields so the current look can be posted back to the API. */
export function toApiItems(look: BuildYourLookData | null): BuildYourLookItem[] | undefined {
  if (!look) return undefined;
  return look.items.map((item) => ({
    id: item.id,
    name: item.name,
    subtitle: item.subtitle,
    description: item.description,
    brand: item.brand,
    material: item.material,
    color: item.color,
    size: item.size,
    price: item.price,
    originalPrice: item.originalPrice,
    rating: item.rating,
    store: item.store,
    category: item.category,
    imageUrl: item.imageUrl,
  }));
}
