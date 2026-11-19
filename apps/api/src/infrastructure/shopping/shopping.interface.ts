import type { Product, ShopAudience, ShoppingProviderState } from "@stylaiize/shared";

export type {
  ShoppingProviderStatus,
  ShoppingProviderStatusEntry,
} from "@stylaiize/shared";

export interface ShoppingSearchInput {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "relevance" | "price_asc" | "price_desc" | "rating" | "discount";
  page?: number;
  limit?: number;
  pinCode?: string;
  audience?: ShopAudience;
  style?: string;
}

export interface ShoppingProviderHealth {
  status: "healthy" | "unhealthy" | "unknown";
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  message: string | null;
}

export interface ShoppingSearchResult {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  source: "api" | "mock";
  fx?: { base: string; quote: string; rate: number; date: string } | null;
  providerId?: string;
  providerLabel?: string;
  checkedAt?: string;
  pinCodeSupported?: boolean;
  pinCode?: string | null;
  notice?: string | null;
}

export interface ShoppingProviderPort {
  readonly isConfigured: boolean;
  readonly demoMode: boolean;
  readonly id?: string;
  readonly label?: string;
  readonly requiresCredentials?: boolean;
  readonly approvalRequired?: boolean;
  readonly supportsPinCode?: boolean;
  readonly connectionState?: ShoppingProviderState;
  readonly supportedAudiences?: readonly ShopAudience[];
  search(input: ShoppingSearchInput): Promise<ShoppingSearchResult>;
  getById(id: string): Promise<Product | null>;
  health?(): ShoppingProviderHealth;
}
