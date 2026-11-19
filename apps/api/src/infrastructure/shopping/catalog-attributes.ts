import type { ShopAudience, ShopStyleTag } from "@stylaiize/shared";

export function inferAudience(text: string | null | undefined): ShopAudience {
  const value = ` ${(text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  if (/\bunisex\b/.test(value)) return "unisex";
  if (/\bwomen|woman|womens|ladies|female|girls|girl\b/.test(value)) return "women";
  if (/\bmen|man|mens|male|boys|boy\b/.test(value)) return "men";
  return "all";
}

export function inferStyleTags(text: string | null | undefined): ShopStyleTag[] {
  const value = ` ${(text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const tags = new Set<ShopStyleTag>();
  if (/\bkurta|kurta|saree|sari|lehenga|sherwani|ethnic|traditional|salwar|dupatta\b/.test(value)) {
    tags.add("traditional");
    tags.add("ethnic");
  }
  if (/\bshirt|tshirt|t shirt|jeans|trouser|dress|blazer|jacket|top|skirt|short\b/.test(value)) {
    tags.add("western");
  }
  if (/\bformal|business|office|suit|blazer|tuxedo\b/.test(value)) tags.add("formal");
  if (/\bcasual|tshirt|t shirt|hoodie|sneaker|jeans|jogger\b/.test(value)) tags.add("casual");
  if (/\bsport|athletic|running|gym|training\b/.test(value)) tags.add("sports");
  return [...tags];
}

export function normalizeCategory(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
