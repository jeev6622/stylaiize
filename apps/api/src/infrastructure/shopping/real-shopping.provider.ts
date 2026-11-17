import { env } from "@/config/env";
import { isShoppingConfigured } from "@/config/features";
import { logError, logInfo } from "@/utils/logger";
import type {
  ShoppingProviderPort,
  ShoppingSearchInput,
  ShoppingSearchResult,
} from "./shopping.interface";
import type { Product } from "@stylaiize/shared";

export class RealShoppingProvider implements ShoppingProviderPort {
  readonly demoMode = false;

  get isConfigured(): boolean {
    return isShoppingConfigured;
  }

  async search(input: ShoppingSearchInput): Promise<ShoppingSearchResult> {
    if (!this.isConfigured) {
      throw new Error("Shopping API not configured.");
    }

    const params = new URLSearchParams({
      q: input.query,
      ...(input.category && { category: input.category }),
      ...(input.minPrice && { minPrice: String(input.minPrice) }),
      ...(input.maxPrice && { maxPrice: String(input.maxPrice) }),
      ...(input.sortBy && { sortBy: input.sortBy }),
      ...(input.page && { page: String(input.page) }),
      ...(input.limit && { limit: String(input.limit) }),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const url = `${env.SHOPPING_API_URL.replace(/\/$/, "")}/search?${params}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.SHOPPING_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Shopping API returned ${res.status}`);
      }

      const data = (await res.json()) as {
        products?: Product[];
        total?: number;
        page?: number;
        totalPages?: number;
      };

      logInfo(`[Shopping] API search: ${data.products?.length ?? 0} results for "${input.query}"`);

      return {
        products: data.products ?? [],
        total: data.total ?? 0,
        page: data.page ?? input.page ?? 1,
        totalPages: data.totalPages ?? 0,
        source: "api",
      };
    } catch (err) {
      logError("Shopping API search failed", err);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getById(id: string): Promise<Product | null> {
    if (!this.isConfigured) return null;

    try {
      const url = `${env.SHOPPING_API_URL.replace(/\/$/, "")}/product/${id}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.SHOPPING_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) return null;
      const data = (await res.json()) as { product?: Product };
      return data.product ?? null;
    } catch (err) {
      logError("Shopping API getById failed", err);
      return null;
    }
  }
}
