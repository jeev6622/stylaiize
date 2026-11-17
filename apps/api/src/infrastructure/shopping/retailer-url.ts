import type { Product } from "@stylaiize/shared";

/**
 * Maps a store name to its real retailer search URL. Used in demo mode so
 * "Visit Store" buttons always open a genuine, live retailer page instead of
 * a dead "#" link.
 */
const STORE_SEARCH_URLS: Record<string, (q: string) => string> = {
  Myntra: (q) => `https://www.myntra.com/${encodeURIComponent(q)}`,
  Amazon: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  Flipkart: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
  Ajio: (q) => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`,
  Nykaa: (q) => `https://www.nykaafashion.com/search/result?q=${encodeURIComponent(q)}`,
};

export function resolveStoreUrl(store: string, query: string): string {
  const builder = STORE_SEARCH_URLS[store];
  if (builder) return builder(query);
  return `https://www.google.com/search?q=${encodeURIComponent(`${store} ${query}`)}`;
}

export function enrichProductBuyUrl(product: Product): Product {
  // Only rewrite dead or empty links. Real integrations keep their own URLs.
  if (product.buyUrl && product.buyUrl !== "#" && product.buyUrl !== "") {
    return product;
  }
  return {
    ...product,
    buyUrl: resolveStoreUrl(product.store, product.title),
  };
}
