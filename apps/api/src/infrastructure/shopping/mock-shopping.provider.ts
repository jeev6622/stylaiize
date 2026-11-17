import type {
  ShoppingProviderPort,
  ShoppingSearchInput,
  ShoppingSearchResult,
} from "./shopping.interface";
import type { Product } from "@stylaiize/shared";
import { searchMockProducts, MOCK_PRODUCTS } from "../products/mock-products";
import { enrichProductBuyUrl } from "./retailer-url";

export class MockShoppingProvider implements ShoppingProviderPort {
  readonly isConfigured = true;
  readonly demoMode = true;

  async search(input: ShoppingSearchInput): Promise<ShoppingSearchResult> {
    const result = searchMockProducts(input.query, {
      category: input.category,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      sortBy: input.sortBy,
      page: input.page,
      limit: input.limit,
    });
    return {
      ...result,
      products: result.products.map(enrichProductBuyUrl),
      source: "mock",
    };
  }

  async getById(id: string): Promise<Product | null> {
    const p = MOCK_PRODUCTS.find((p) => p.id === id) ?? null;
    return p ? enrichProductBuyUrl(p) : null;
  }
}
