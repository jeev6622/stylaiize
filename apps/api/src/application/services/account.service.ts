import type { Product, User } from "@stylaiize/shared";
import { userRepository } from "@/infrastructure/repos/user.repo";
import { savedOutfitRepository } from "@/infrastructure/repos/saved-outfit.repo";
import { wardrobeRepository } from "@/infrastructure/repos/wardrobe.repo";
import { notificationStatus } from "@/application/services/notification.service";
import { getProductById, getShoppingStatus } from "@/application/services/product.service";
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "@/utils/password";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "@/utils/errors";

const MAX_FAVOURITES = 50;

export interface AccountSummary {
  user: Pick<User, "id" | "name" | "email" | "mobile" | "countryCode" | "avatarUrl" | "role" | "emailVerified" | "mobileVerified" | "providers" | "createdAt">;
  stats: {
    savedOutfits: number;
    wardrobeItems: number;
    favourites: number;
    memberSince: string;
  };
  security: {
    hasPassword: boolean;
    googleLinked: boolean;
  };
}

export interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function getAccountSummary(userId: string): Promise<AccountSummary> {
  const repo = userRepository();
  const user = await repo.findById(userId);
  if (!user) throw new NotFoundError("User not found.");

  const [savedOutfits, wardrobeItems] = await Promise.all([
    savedOutfitRepository().countByUserId(userId),
    wardrobeRepository().countByUserId(userId),
  ]);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      countryCode: user.countryCode,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: user.emailVerified,
      mobileVerified: user.mobileVerified,
      providers: user.providers,
      createdAt: user.createdAt,
    },
    stats: {
      savedOutfits,
      wardrobeItems,
      favourites: user.preferences.favoriteProducts?.length ?? 0,
      memberSince: user.createdAt,
    },
    security: {
      hasPassword: Boolean(user.passwordHash),
      googleLinked: (user.providers ?? []).includes("google"),
    },
  };
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<User> {
  const repo = userRepository();
  const user = await repo.findById(userId);
  if (!user) throw new NotFoundError("User not found.");

  const patch: Partial<Pick<User, "name" | "avatarUrl">> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.avatarUrl !== undefined) {
    patch.avatarUrl =
      input.avatarUrl === null || input.avatarUrl.trim() === ""
        ? null
        : input.avatarUrl.trim();
  }

  const updated = await repo.update(user.id, { ...patch, preferences: user.preferences });
  if (!updated) throw new NotFoundError("User not found.");
  return updated;
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<{ changed: boolean }> {
  const repo = userRepository();
  const user = await repo.findById(userId);
  if (!user) throw new NotFoundError("User not found.");

  if (!user.passwordHash) {
    throw new BadRequestError(
      "This account has no password set. Sign in with Google and link a password, or use password reset.",
      "NO_PASSWORD",
    );
  }

  const matches = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!matches) {
    throw new UnauthorizedError("Current password is incorrect.", "INVALID_PASSWORD");
  }

  const strength = validatePasswordStrength(input.newPassword);
  if (!strength.valid) {
    throw new BadRequestError(
      `New password is too weak: ${strength.errors.join(" ")}`,
      "WEAK_PASSWORD",
    );
  }

  const passwordHash = await hashPassword(input.newPassword);
  await repo.update(user.id, { passwordHash, preferences: user.preferences });
  return { changed: true };
}

/** Cap on stored device tokens per user, oldest registrations dropped first. */
const MAX_DEVICE_TOKENS = 10;

export interface DeviceTokenResult {
  deviceTokens: string[];
  pushNotifications: boolean;
}

/**
 * Registers an FCM registration token for the current user so price-alert and
 * reminder notifications can reach their devices. Idempotent: re-registering a
 * known token is a no-op.
 *
 * Registering a device also opts the user into push: the first device flips
 * `pushNotifications` on (unless it was already set) and adds "push" to the
 * allowed notification channels, so a registered device is actually reachable.
 * Users who do not want push can still set `pushNotifications` back to false.
 */
export async function registerDeviceToken(
  userId: string,
  token: string,
): Promise<DeviceTokenResult> {
  const repo = userRepository();
  const user = await repo.findById(userId);
  if (!user) throw new NotFoundError("User not found.");

  const incoming = token.trim();
  const existing = user.preferences?.deviceTokens ?? [];
  if (existing.includes(incoming)) {
    return {
      deviceTokens: existing,
      pushNotifications: user.preferences.pushNotifications,
    };
  }

  const deviceTokens = [...existing, incoming].slice(-MAX_DEVICE_TOKENS);
  const channels = user.preferences.notificationChannels ?? [];
  const updated = await repo.update(userId, {
    preferences: {
      ...user.preferences,
      deviceTokens,
      notificationChannels: channels.includes("push")
        ? channels
        : [...channels, "push"],
      // Opt in on first device unless the user previously opted out.
      pushNotifications:
        existing.length === 0 ? true : user.preferences.pushNotifications,
    },
  });
  if (!updated) throw new NotFoundError("User not found.");

  return {
    deviceTokens,
    pushNotifications: updated.preferences.pushNotifications,
  };
}

/** Removes a device token (on sign-out or device revocation). */
export async function unregisterDeviceToken(
  userId: string,
  token: string,
): Promise<DeviceTokenResult> {
  const repo = userRepository();
  const user = await repo.findById(userId);
  if (!user) throw new NotFoundError("User not found.");

  const deviceTokens = (user.preferences?.deviceTokens ?? []).filter(
    (t) => t !== token.trim(),
  );

  const updated = await repo.update(userId, {
    preferences: { ...user.preferences, deviceTokens },
  });
  if (!updated) throw new NotFoundError("User not found.");

  return { deviceTokens, pushNotifications: updated.preferences.pushNotifications };
}

/** Current push-delivery capability, so the client can hide dead UI. */
export async function getNotificationStatus(userId: string): Promise<{
  active: boolean;
  demoMode: boolean;
  deviceCount: number;
  pushEnabled: boolean;
}> {
  const repo = userRepository();
  const user = await repo.findById(userId);
  const deviceTokens = user?.preferences?.deviceTokens ?? [];
  return {
    ...notificationStatus(),
    deviceCount: deviceTokens.length,
    pushEnabled: Boolean(user?.preferences?.pushNotifications) && deviceTokens.length > 0,
  };
}

export interface FavouritesResult {
  favourites: Product[];
  /** True when the saved snapshots came from the sample catalog, not live listings. */
  demoMode: boolean;
}

async function verifyProduct(product: Product): Promise<Product> {
  const verified = await getProductById(product.id);
  if (!verified || verified.id !== product.id) {
    throw new NotFoundError("This product is no longer available.", "PRODUCT_NOT_FOUND");
  }
  const matches =
    verified.title === product.title &&
    verified.brand === product.brand &&
    verified.imageUrl === product.imageUrl &&
    verified.price === product.price &&
    verified.currency === product.currency &&
    verified.store === product.store &&
    verified.category === product.category &&
    verified.buyUrl === product.buyUrl;
  if (!matches) {
    throw new BadRequestError(
      "Product details do not match the catalog. Refresh the product and try again.",
      "PRODUCT_MISMATCH",
    );
  }
  return verified;
}

export async function getFavourites(userId: string): Promise<FavouritesResult> {
  const repo = userRepository();
  const user = await repo.findById(userId);
  if (!user) throw new NotFoundError("User not found.");
  return {
    favourites: user.preferences.favoriteProducts ?? [],
    demoMode: getShoppingStatus().demoMode,
  };
}

export async function saveFavourite(
  userId: string,
  product: Product,
): Promise<FavouritesResult> {
  const verified = await verifyProduct(product);
  const repo = userRepository();
  const user = await repo.findById(userId);
  if (!user) throw new NotFoundError("User not found.");

  const existing = user.preferences.favoriteProducts ?? [];
  const deduped = [verified, ...existing.filter((p) => p.id !== verified.id)].slice(
    0,
    MAX_FAVOURITES,
  );

  const updated = await repo.update(userId, {
    preferences: {
      ...user.preferences,
      favoriteProducts: deduped,
    },
  });
  if (!updated) throw new NotFoundError("User not found.");
  return {
    favourites: updated.preferences.favoriteProducts ?? [],
    demoMode: getShoppingStatus().demoMode,
  };
}

export async function removeFavourite(
  userId: string,
  productId: string,
): Promise<FavouritesResult> {
  const repo = userRepository();
  const user = await repo.findById(userId);
  if (!user) throw new NotFoundError("User not found.");

  const favourites = (user.preferences.favoriteProducts ?? []).filter(
    (p) => p.id !== productId,
  );
  const updated = await repo.update(userId, {
    preferences: { ...user.preferences, favoriteProducts: favourites },
  });
  if (!updated) throw new NotFoundError("User not found.");
  return {
    favourites: updated.preferences.favoriteProducts ?? [],
    demoMode: getShoppingStatus().demoMode,
  };
}
