import type { CompleteOutfitImage, Product, ShopAudience } from "@stylaiize/shared";

export type OutfitGarmentSlot =
  | "top"
  | "outerwear"
  | "bottom"
  | "footwear"
  | "accessory";

export type OutfitGarmentRenderMode = "exact" | "template" | "2d";

export type StyleType = "classic" | "modern" | "luxury" | "minimal" | "streetwear" | "traditional";
export type BudgetLevel = "2000" | "5000" | "10000" | "premium";

export interface EstimatedBudgetInr {
  min: number;
  max: number | null;
  currency: "INR";
}

export interface OutfitItem {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  brand: string | null;
  material: string;
  color: string;
  size: string;
  rating: number;
  store: string;
  imageUrl: string | null;
  hotspotPosition: [number, number, number];
  category: string;
}

export interface OutfitPiece {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  description: string;
  category: string;
  slot: OutfitGarmentSlot | null;
  color: string;
  colorHex: string;
  imageUrl: string | null;
  material: string;
  size: string;
  hotspotPosition: [number, number, number];
  product: Product | null;
  renderMode: OutfitGarmentRenderMode;
}

export interface OutfitData {
  eventName: string;
  audience: ShopAudience;
  inspirationImageUrl?: string | null;
  completeOutfitImage?: CompleteOutfitImage | null;
  styleName: string;
  styleMatch: number;
  eventMatch: number;
  items: OutfitItem[];
  originalTotal: number;
  optimizedTotal: number;
  savings: number;
  estimatedBudgetInr?: EstimatedBudgetInr;
  colorCombination?: string;
  footwear?: string;
  accessories?: string[];
  explanation?: string;
  weatherNote?: string | null;
  dressCode?: string | null;
  dressCodeReason?: string | null;
  recommendedColors?: string[];
  fitGuidance?: string | null;
  accessoryGuidance?: string | null;
  groomingGuidance?: string | null;
  occasionSuitability?: string | null;
  seasonSuitability?: string | null;
  shoppingQueries?: string[];
}

export type ScrollStageKind =
  | "overview"
  | "analysis"
  | "item"
  | "grooming"
  | "recommendation"
  | "products"
  | "shopping";

export interface ScrollStage {
  id: number;
  kind: ScrollStageKind;
  title: string;
  subtitle: string;
  label: string;
  description?: string;
  /** Index into the outfit items for `kind: "item"` stages. */
  itemIndex?: number;
  highlightCategories: string[];
}
