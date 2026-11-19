import type {
  PriceComparisonEntry,
  Product,
  ProductAlternative,
} from "@stylaiize/shared";

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string | null | undefined): Set<string> {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 2));
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(a.size, b.size);
}

function globalIdentifier(product: Product): string | null {
  const id = normalize(product.productIdentifier ?? null);
  if (!id) return null;
  if (!/^(gtin|ean|upc|isbn|mpn|style|sku)\s/.test(id)) return null;
  return id;
}

function audiencesCompatible(target: Product, candidate: Product): boolean {
  const targetAudience = target.audience ?? "all";
  const candidateAudience = candidate.audience ?? "all";
  if (targetAudience === candidateAudience) return true;
  const explicit = (audience: string) =>
    audience === "men" || audience === "women" || audience === "unisex";
  if (!explicit(targetAudience) || !explicit(candidateAudience)) return false;
  return targetAudience === "unisex" || candidateAudience === "unisex";
}

export function isExactProductMatch(target: Product, candidate: Product): boolean {
  if (candidate.currency !== target.currency) return false;
  if (normalize(candidate.category) !== normalize(target.category)) return false;
  if (!audiencesCompatible(target, candidate)) return false;

  const targetBrand = normalize(target.brand);
  const candidateBrand = normalize(candidate.brand);
  if (!targetBrand || !candidateBrand || targetBrand !== candidateBrand) return false;

  const targetId = globalIdentifier(target);
  const candidateId = globalIdentifier(candidate);
  if (targetId || candidateId) {
    return Boolean(targetId && candidateId && targetId === candidateId);
  }

  return normalize(target.title) === normalize(candidate.title);
}

function isSameListing(a: Product, b: Product): boolean {
  return (
    normalize(a.buyUrl) === normalize(b.buyUrl) ||
    (a.id === b.id && normalize(a.store) === normalize(b.store))
  );
}

export function findExactMatches(target: Product, candidates: Product[]): Product[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (isSameListing(target, candidate) || !isExactProductMatch(target, candidate)) return false;
    const key = `${normalize(candidate.store)}|${normalize(candidate.buyUrl)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function findSimilarAlternatives(
  target: Product,
  candidates: Product[],
  limit = 5,
): ProductAlternative[] {
  const targetTokens = tokens(`${target.title} ${target.brand ?? ""}`);
  const targetColors = tokens(target.colors.join(" "));
  const targetPrice = target.price;

  const scored = candidates
    .filter((candidate) => candidate.currency === target.currency)
    .filter((candidate) => !isSameListing(target, candidate))
    .filter((candidate) => !isExactProductMatch(target, candidate))
    .filter(
      (candidate) =>
        normalize(candidate.category) === normalize(target.category) ||
        similarity(tokens(candidate.category), tokens(target.category)) > 0,
    )
    .map((candidate) => {
      const titleScore = similarity(targetTokens, tokens(`${candidate.title} ${candidate.brand ?? ""}`));
      const colorScore = similarity(targetColors, tokens(candidate.colors.join(" ")));
      const brandScore =
        target.brand && candidate.brand && normalize(target.brand) === normalize(candidate.brand)
          ? 1
          : 0;
      const priceScore = targetPrice > 0 ? 1 - Math.min(1, Math.abs(candidate.price - targetPrice) / targetPrice) : 0;
      const matchScore = Math.round(
        Math.min(100, (titleScore * 0.6 + colorScore * 0.15 + brandScore * 0.15 + priceScore * 0.1) * 100),
      );
      const reasons: string[] = [];
      if (titleScore > 0) reasons.push("similar title/style");
      if (brandScore > 0) reasons.push("same brand");
      if (colorScore > 0) reasons.push("matching colour option");
      if (priceScore > 0.7) reasons.push("comparable price");
      return {
        product: candidate,
        matchScore,
        reason: reasons.length ? reasons.join(", ") : "same category",
      };
    })
    .filter((entry) => entry.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore || a.product.price - b.product.price);

  const seen = new Set<string>();
  return scored
    .filter((entry) => {
      const key = `${normalize(entry.product.store)}|${normalize(entry.product.buyUrl)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function rankComparisonEntries(products: Product[]): PriceComparisonEntry[] {
  const lowest = Math.min(...products.map((product) => product.price));
  const highestRating = Math.max(...products.map((product) => product.rating ?? 0));
  const fastestDelivery = Math.min(
    ...products.map((product) => product.deliveryEstimateDays?.max ?? 99),
  );

  return products.map((product) => ({
    product,
    isLowestPrice: product.price === lowest,
    isHighestRated: (product.rating ?? 0) === highestRating,
    isFastestDelivery: (product.deliveryEstimateDays?.max ?? 99) === fastestDelivery,
    isBestValue:
      product.price === lowest && (product.rating ?? 0) >= highestRating - 0.2,
  }));
}
