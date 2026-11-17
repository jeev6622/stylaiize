import type { Product, PriceComparison, PriceComparisonEntry } from "@stylaiize/shared";
import {
  resolveShoppingProvider,
  shoppingProviderStatus,
} from "@/infrastructure/shopping/factory";

export interface SearchInput {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "relevance" | "price_asc" | "price_desc" | "rating" | "discount";
  page?: number;
  limit?: number;
}

export async function searchProducts(input: SearchInput) {
  const provider = resolveShoppingProvider();
  const result = await provider.search(input);
  return { ...result, demoMode: provider.demoMode };
}

export async function compareProducts(
  productIds: string[],
): Promise<PriceComparison> {
  const provider = resolveShoppingProvider();

  const products: Product[] = [];
  for (const id of productIds) {
    const p = await provider.getById(id);
    if (p) products.push(p);
  }

  if (products.length === 0)
    return { canonicalTitle: "No products found", entries: [] };

  const lowestPrice = Math.min(...products.map((p) => p.price));
  const highestRating = Math.max(...products.map((p) => p.rating ?? 0));
  const fastestDelivery = Math.min(...products.map((p) => p.deliveryEstimateDays?.max ?? 99));

  const entries: PriceComparisonEntry[] = products.map((product) => ({
    product,
    isLowestPrice: product.price === lowestPrice,
    isHighestRated: (product.rating ?? 0) === highestRating,
    isFastestDelivery: (product.deliveryEstimateDays?.max ?? 99) === fastestDelivery,
    isBestValue:
      product.price === lowestPrice &&
      (product.rating ?? 0) >= highestRating - 0.2,
  }));

  return {
    canonicalTitle: products[0]?.title ?? "Comparison",
    entries,
  };
}

export async function getProductById(id: string): Promise<Product | null> {
  const provider = resolveShoppingProvider();
  return provider.getById(id);
}

/** Exposed so the frontend can disclose demo vs live catalog results. */
export function getShoppingStatus() {
  return shoppingProviderStatus();
}
