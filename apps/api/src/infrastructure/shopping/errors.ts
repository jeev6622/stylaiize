import { AppError } from "@/utils/errors";

/**
 * Raised when the shopping provider is pinned to the live catalog but the
 * required credentials are missing. This is intentionally *not* swallowed:
 * returning mock products while pretending they are live results would show
 * users fabricated prices and buy links.
 */
export class ShoppingNotConfiguredError extends AppError {
  constructor() {
    super(
      503,
      "Live shopping search is not configured. Set SHOPPING_ENABLED=true with SHOPPING_API_URL (and SHOPPING_API_KEY if the provider needs one), or set SHOPPING_PROVIDER=mock to deliberately use the demo catalog.",
      { code: "SHOPPING_NOT_CONFIGURED" },
    );
  }
}
