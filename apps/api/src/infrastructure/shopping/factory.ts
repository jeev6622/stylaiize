import { env } from "@/config/env";
import { logInfo } from "@/utils/logger";
import { RealShoppingProvider } from "./real-shopping.provider";
import { MockShoppingProvider } from "./mock-shopping.provider";
import { LivostyleFeedProvider } from "./livostyle-feed.provider";
import { AmazonCreatorsProvider } from "./amazon-creators.provider";
import { FlipkartAffiliateProvider } from "./flipkart-affiliate.provider";
import { MultiShoppingProvider } from "./multi-provider";
import { ShoppingNotConfiguredError } from "./errors";
import type { ShoppingProviderPort, ShoppingProviderStatus } from "./shopping.interface";

let cached: MultiShoppingProvider | null = null;

function configuredOfficialProviders(): ShoppingProviderPort[] {
  const providers: ShoppingProviderPort[] = [
    new AmazonCreatorsProvider(),
    new FlipkartAffiliateProvider(),
    new RealShoppingProvider({
      id: "myntra",
      label: "Myntra approved feed",
      url: env.MYNTRA_AFFILIATE_FEED_URL,
      approvalRequired: true,
    }),
    new RealShoppingProvider({
      id: "ajio",
      label: "AJIO approved feed",
      url: env.AJIO_AFFILIATE_FEED_URL,
      approvalRequired: true,
    }),
    new RealShoppingProvider(),
  ];
  return providers.filter((provider) => provider.isConfigured);
}

function createProvider(): MultiShoppingProvider {
  const freeFeed = new LivostyleFeedProvider();
  const pinned = env.SHOPPING_PROVIDER;

  if (pinned === "mock") {
    return new MultiShoppingProvider([new MockShoppingProvider()]);
  }
  if (pinned === "livostyle") {
    return new MultiShoppingProvider([freeFeed]);
  }
  if (pinned === "amazon_in") {
    const amazon = new AmazonCreatorsProvider();
    if (!amazon.isConfigured) throw new ShoppingNotConfiguredError();
    return new MultiShoppingProvider([amazon]);
  }
  if (pinned === "flipkart") {
    const flipkart = new FlipkartAffiliateProvider();
    if (!flipkart.isConfigured) throw new ShoppingNotConfiguredError();
    return new MultiShoppingProvider([flipkart]);
  }
  if (pinned === "real") {
    const official = configuredOfficialProviders();
    if (official.length === 0) throw new ShoppingNotConfiguredError();
    return new MultiShoppingProvider(official);
  }
  const official = configuredOfficialProviders();
  return new MultiShoppingProvider(official.length > 0 ? [freeFeed, ...official] : [freeFeed]);
}

export function resolveShoppingProvider(): MultiShoppingProvider {
  if (cached) return cached;
  cached = createProvider();
  logInfo(
    `Shopping providers resolved: ${cached.describeProviders().filter((p) => p.connected).map((p) => p.label).join(" + ")}` +
      (cached.demoMode ? " (demo catalog - results are sample data, not live listings)" : ""),
  );
  return cached;
}

function resolveActiveProviderId(
  pinned: string,
  active: ShoppingProviderStatus["active"],
  provider: MultiShoppingProvider | null,
): string | null {
  if (active === "mock") return "mock";
  if (active === "none") return null;
  if (pinned === "amazon_in" || pinned === "flipkart") return pinned;
  if (pinned === "livostyle") return "livostyle";

  const ids = provider?.activeProviderIds ?? [];
  if (ids.length === 0) return null;
  if (ids.length === 1) return ids[0] ?? null;
  return ids.every((id) => id === "livostyle") ? "livostyle" : "multi";
}

export function shoppingProviderStatus(): ShoppingProviderStatus {
  let provider: MultiShoppingProvider | null = cached;
  if (!provider) {
    try {
      provider = resolveShoppingProvider();
    } catch {
      provider = null;
    }
  }

  const pinned = env.SHOPPING_PROVIDER;
  const officialConfigured = configuredOfficialProviders().length > 0;
  const active: ShoppingProviderStatus["active"] =
    pinned === "mock"
      ? "mock"
      : pinned === "real" && !officialConfigured
        ? "none"
        : pinned === "amazon_in" || pinned === "flipkart"
          ? configuredOfficialProviders().some((item) => item.id === pinned)
            ? "real"
            : "none"
          : "real";

  return {
    active,
    activeProviderId: resolveActiveProviderId(pinned, active, provider),
    demoMode: provider?.demoMode ?? false,
    configured: provider?.isConfigured ?? false,
    providers:
      provider?.describeProviders() ?? new MultiShoppingProvider([]).describeProviders(),
  };
}

export function resetShoppingProvider(): void {
  cached = null;
}
