import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPriceAlertTarget(amount: number | null, currency: string): string {
  if (amount === null) return "Any price";
  return formatCurrency(amount, currency);
}

export function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

const STORE_SEARCH_URLS: Record<string, (q: string) => string> = {
  Myntra: (q) => `https://www.myntra.com/${encodeURIComponent(q)}`,
  Amazon: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  Flipkart: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
  Ajio: (q) => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`,
  Nykaa: (q) => `https://www.nykaafashion.com/search/result?q=${encodeURIComponent(q)}`,
};

/**
 * Returns a store search URL only for stores we know.
 *
 * Returns `null` for anything else on purpose: these items come from the AI,
 * which supplies a suggested store name and no verified product link. A
 * generic web search would look like a real product URL but is not one.
 */
export function storeSearchUrl(store: string, query: string): string | null {
  if (!store || !query) return null;
  const builder = STORE_SEARCH_URLS[store];
  return builder ? builder(query) : null;
}

/**
 * The buy link for an item, when one genuinely exists.
 *
 * Prefers the `buyUrl` supplied by the shopping provider. Only falls back to a
 * store search page when we know the store, and never fabricates a link.
 */
export function itemBuyLink(item: {
  buyUrl?: string | null;
  brand?: string | null;
  name: string;
}): string | null {
  if (item.buyUrl) {
    try {
      const parsed = new URL(item.buyUrl);
      // Blocks `javascript:` and other dangerous schemes from stored data.
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return parsed.toString();
      }
    } catch {
      // Malformed stored URL: fall through to the store search.
    }
  }
  return null;
}
