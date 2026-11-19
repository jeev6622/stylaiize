import type { Product, ProductPinCodeAvailability } from "@stylaiize/shared";
import type { ShoppingSearchResult } from "@/infrastructure/shopping/shopping.interface";

const PIN_CHECK_UNAVAILABLE =
  "Please confirm delivery availability on the retailer's website.";

export function validateAvailability(
  product: Product | null,
  pinCode: string | null,
  result: ShoppingSearchResult,
): ProductPinCodeAvailability | null {
  if (!pinCode) return null;
  const reported = product?.pinCodeAvailability;
  if (
    reported &&
    reported.pinCode === pinCode &&
    reported.supported &&
    typeof reported.available === "boolean"
  ) {
    return {
      ...reported,
      pinCode,
      available: reported.available,
      checkedAt: reported.checkedAt ?? result.checkedAt ?? null,
    };
  }

  return {
    supported: false,
    pinCode,
    available: null,
    deliveryEstimateDays: null,
    deliveryDate: null,
    deliveryChargesInr: null,
    availableSizes: null,
    availableColors: null,
    message: PIN_CHECK_UNAVAILABLE,
    checkedAt: null,
  };
}
