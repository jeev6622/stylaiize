import type {
  PriceComparison,
  PriceComparisonEntry,
  Product,
  ProductComparisonGroup,
} from "@stylaiize/shared";
import {
  findExactMatches,
  findSimilarAlternatives,
  rankComparisonEntries,
} from "./product-matching.service";

function latestTimestamp(products: Product[]): string | null {
  return (
    products
      .map((product) => product.priceVerifiedAt)
      .filter((value): value is string => typeof value === "string")
      .sort()
      .pop() ?? null
  );
}

export function buildProductComparison(
  target: Product,
  candidates: Product[],
): ProductComparisonGroup {
  const exactProducts = findExactMatches(target, candidates);
  const exactMatches: PriceComparisonEntry[] = rankComparisonEntries(exactProducts);
  const similarAlternatives = findSimilarAlternatives(target, candidates, 6);
  const priced = [target, ...exactProducts].filter(
    (product) => product.currency === "INR",
  );
  const prices = priced.map((product) => product.price);
  const lowestPriceInr = prices.length ? Math.min(...prices) : null;
  const highestPriceInr = prices.length ? Math.max(...prices) : null;

  return {
    target,
    exactMatches,
    similarAlternatives,
    lowestPriceInr,
    highestPriceInr,
    priceDifferenceInr:
      lowestPriceInr !== null && highestPriceInr !== null
        ? highestPriceInr - lowestPriceInr
        : null,
    lastCheckedAt: latestTimestamp([target, ...exactProducts]),
    note: exactMatches.length
      ? `${exactMatches.length} verified same-product retailer listing(s).`
      : "No verified same-product listing from another connected provider. Similar alternatives are not the same item.",
  };
}

export function compareProductList(products: Product[]): PriceComparison {
  const [target, ...rest] = products;
  if (!target) {
    return {
      canonicalTitle: "Comparison",
      entries: [],
      exactMatches: [],
      similarAlternatives: [],
      lowestPriceInr: null,
      highestPriceInr: null,
      priceDifferenceInr: null,
      lastCheckedAt: null,
      note: "No verified products were found for comparison.",
    };
  }
  const group = buildProductComparison(target, rest);
  return {
    canonicalTitle: target.title,
    entries: rankComparisonEntries([target, ...group.exactMatches.map((entry) => entry.product)]),
    exactMatches: group.exactMatches,
    similarAlternatives: group.similarAlternatives,
    lowestPriceInr: group.lowestPriceInr,
    highestPriceInr: group.highestPriceInr,
    priceDifferenceInr: group.priceDifferenceInr,
    lastCheckedAt: group.lastCheckedAt,
    note: group.note,
  };
}
