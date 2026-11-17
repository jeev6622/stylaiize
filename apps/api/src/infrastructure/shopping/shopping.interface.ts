import type { Product } from "@stylaiize/shared";

export interface ShoppingSearchInput {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "relevance" | "price_asc" | "price_desc" | "rating" | "discount";
  page?: number;
  limit?: number;
}

export interface ShoppingSearchResult {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  source: "api" | "mock";
}

export interface ShoppingProviderPort {
  readonly isConfigured: boolean;
  readonly demoMode: boolean;
  search(input: ShoppingSearchInput): Promise<ShoppingSearchResult>;
  getById(id: string): Promise<Product | null>;
}
