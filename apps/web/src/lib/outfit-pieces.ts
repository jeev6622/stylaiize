import { API_ENDPOINTS, type BuildLookShopResult, type Product, type ShopAudience } from "@stylaiize/shared";
import type {
  OutfitGarmentRenderMode,
  OutfitGarmentSlot,
  OutfitItem,
  OutfitPiece,
} from "@/components/build-look/types";

const SLOT_PATTERNS: ReadonlyArray<[OutfitGarmentSlot, RegExp]> = [
  ["outerwear", /jacket|blazer|coat|trench|parka|hoodie|cardigan|outerwear|suit/i],
  ["bottom", /trouser|pants?|jeans?|bottom|skirt|short|denim|chino|legging/i],
  ["footwear", /shoe|loafer|boot|sneaker|trainer|sandal|heel|slipper/i],
  [
    "accessory",
    /accessor|belt|watch|bag|jewel|necklace|earring|scarf|glasses|sunglass|groom|perfume/i,
  ],
  ["top", /shirt|t-?shirt|blouse|top|tee|knit|sweater|polo|kurta|dress|gown|vest|upperwear/i],
];

const NAMED_COLORS: Record<string, string> = {
  black: "#111827",
  white: "#f8fafc",
  ivory: "#f5f0e6",
  cream: "#f2e8cf",
  beige: "#d6c3a5",
  khaki: "#9a8865",
  brown: "#7c4a2d",
  tan: "#b2895c",
  grey: "#71717a",
  gray: "#71717a",
  charcoal: "#374151",
  navy: "#1e3a8a",
  blue: "#2563eb",
  denim: "#3b6ea5",
  teal: "#0f766e",
  green: "#15803d",
  olive: "#4d7c0f",
  yellow: "#eab308",
  gold: "#c9a227",
  orange: "#ea580c",
  red: "#b91c1c",
  maroon: "#7f1d1d",
  pink: "#db2777",
  purple: "#7c3aed",
  silver: "#94a3b8",
};

export function mapCategoryToGarmentSlot(category: string): OutfitGarmentSlot | null {
  const value = category.trim();
  for (const [slot, pattern] of SLOT_PATTERNS) {
    if (pattern.test(value)) return slot;
  }
  return null;
}

export function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function isExactModel3dUrl(value: string | null | undefined): boolean {
  if (!isHttpsUrl(value)) return false;
  return /\.glb(?:[?#]|$)/i.test(value as string);
}

export function buildProductModel3dProxyUrl(value: string): string {
  return `${API_ENDPOINTS.productModel3d}?url=${encodeURIComponent(value)}`;
}

export function isVerifiedOutfitProduct(
  product: Product | null | undefined,
  audience: ShopAudience,
): product is Product {
  if (!product) return false;
  if (!product.id || !product.title) return false;
  if (!Number.isFinite(product.price) || product.price <= 0) return false;
  if (product.currency !== "INR") return false;
  if (!product.priceVerifiedAt || !product.inStock) return false;
  if (!isHttpsUrl(product.imageUrl) || !isHttpsUrl(product.buyUrl)) return false;
  return product.audience === audience || product.audience === "unisex";
}

export function productColorToHex(product: Product | null, fallback: string): string {
  const candidates = [product?.colors?.[0], fallback]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim().toLowerCase());

  for (const candidate of candidates) {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(candidate);
    if (hex) {
      const digits = hex[1]!;
      return digits.length === 3
        ? `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`
        : `#${digits}`;
    }
    if (NAMED_COLORS[candidate]) return NAMED_COLORS[candidate]!;
    const named = Object.entries(NAMED_COLORS).find(([name]) => candidate.includes(name));
    if (named) return named[1];
  }

  return "#64748b";
}

export function resolveGarmentRenderMode(
  product: Product | null,
  slot: OutfitGarmentSlot | null,
  item: OutfitItem,
): OutfitGarmentRenderMode {
  if (isExactModel3dUrl(product?.model3dUrl)) return "exact";
  if (slot) return "template";
  if (isHttpsUrl(product?.imageUrl ?? item.imageUrl)) return "2d";
  return "template";
}

export function buildOutfitPieces(
  items: OutfitItem[],
  shopResult: BuildLookShopResult | null,
  audience: ShopAudience,
): OutfitPiece[] {
  const matches = new Map((shopResult?.matches ?? []).map((match) => [match.itemId, match]));

  return items.map((item, index) => {
    const match = matches.get(item.id);
    const candidate = match?.product ?? null;
    const product = isVerifiedOutfitProduct(candidate, audience) ? candidate : null;
    const slot = mapCategoryToGarmentSlot(item.category);

    return {
      id: item.id,
      index,
      name: item.name,
      subtitle: item.subtitle,
      description: item.description,
      category: item.category,
      slot,
      color: item.color,
      colorHex: productColorToHex(product, item.color),
      imageUrl: product?.imageUrl ?? item.imageUrl,
      material: item.material,
      size: item.size,
      hotspotPosition: item.hotspotPosition,
      product,
      renderMode: resolveGarmentRenderMode(product, slot, item),
    };
  });
}

export function findOutfitPiece(pieces: OutfitPiece[], pieceId: string | null): OutfitPiece | null {
  if (!pieceId) return null;
  return pieces.find((piece) => piece.id === pieceId) ?? null;
}
