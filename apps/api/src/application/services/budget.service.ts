import type { BuildLookBudgetSummary, Product } from "@stylaiize/shared";

export interface BudgetItem {
  itemId: string;
  product: Product | null;
  alternatives: Product[];
}

function verifiedInr(product: Product): boolean {
  return product.currency === "INR" && typeof product.price === "number";
}

export function calculateBuildLookBudget(
  budget: string,
  items: BudgetItem[],
): BuildLookBudgetSummary {
  const capInr = budget === "premium" ? null : Number.parseInt(budget, 10);
  const selected = items.map((item) => item.product).filter((p): p is Product => p !== null);
  const complete =
    items.length > 0 &&
    selected.length === items.length &&
    selected.every(verifiedInr) &&
    selected.every((product) => Boolean(product.priceVerifiedAt));
  const selectedTotalInr = complete
    ? selected.reduce((sum, product) => sum + product.price, 0)
    : null;
  const remainingInr =
    selectedTotalInr !== null && capInr !== null ? capInr - selectedTotalInr : null;

  const cheapestProductIdsByItem: Record<string, string> = {};
  let cheapestCompleteOutfitInr = 0;
  let hasCompleteCheapest = items.length > 0;

  for (const item of items) {
    const options = [item.product, ...item.alternatives.slice(0, 5)]
      .filter((product): product is Product => product !== null)
      .filter(verifiedInr)
      .sort((a, b) => a.price - b.price);
    const cheapest = options[0];
    if (!cheapest) {
      hasCompleteCheapest = false;
      continue;
    }
    cheapestProductIdsByItem[item.itemId] = cheapest.id;
    cheapestCompleteOutfitInr += cheapest.price;
  }

  if (!hasCompleteCheapest) cheapestCompleteOutfitInr = 0;

  return {
    budget,
    capInr,
    selectedTotalInr,
    remainingInr,
    cheapestCompleteOutfitInr: hasCompleteCheapest ? cheapestCompleteOutfitInr : null,
    cheapestProductIdsByItem: hasCompleteCheapest ? cheapestProductIdsByItem : null,
    complete,
    note: complete
      ? capInr !== null && selectedTotalInr !== null && selectedTotalInr > capInr
        ? "All prices are verified, but the selected outfit is above your total budget."
        : "All prices are verified in INR."
      : "A complete total is hidden because at least one verified INR price is missing.",
  };
}
