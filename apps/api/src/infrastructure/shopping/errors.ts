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
      "Live product search is currently unavailable.",
      { code: "SHOPPING_NOT_CONFIGURED" },
    );
  }
}

export class ShoppingUnavailableError extends AppError {
  constructor() {
    super(503, "Live product search is currently unavailable.", {
      code: "SHOPPING_UNAVAILABLE",
    });
  }
}

export class ShoppingAuthenticationError extends Error {
  readonly provider: string;
  constructor(providerLabel: string) {
    super(`${providerLabel} authentication failed.`);
    this.name = "ShoppingAuthenticationError";
    this.provider = providerLabel;
  }
}
