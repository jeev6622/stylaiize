export type StyleType = "classic" | "modern" | "luxury" | "minimal" | "streetwear" | "traditional";
export type BudgetLevel = "2000" | "5000" | "10000" | "premium";

export interface OutfitItem {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  brand: string;
  material: string;
  color: string;
  size: string;
  rating: number;
  store: string;
  imageUrl: string | null;
  hotspotPosition: [number, number, number];
  category: string;
}

export interface OutfitData {
  eventName: string;
  styleName: string;
  styleMatch: number;
  eventMatch: number;
  items: OutfitItem[];
  originalTotal: number;
  optimizedTotal: number;
  savings: number;
}

export type ScrollStageKind =
  | "overview"
  | "analysis"
  | "item"
  | "grooming"
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
