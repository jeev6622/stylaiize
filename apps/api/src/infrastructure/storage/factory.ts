import type { StorageProvider } from "@stylaiize/shared";
import { logInfo } from "@/utils/logger";
import { CloudinaryStorage } from "./cloudinary.storage";
import { LocalStorage } from "./local.storage";
import type { StorageProviderPort } from "./storage.interface";

let cached: StorageProviderPort | null = null;

export function resolveStorageProvider(): StorageProviderPort {
  if (cached) return cached;
  const cloudinary = new CloudinaryStorage();
  cached = cloudinary.isConfigured ? cloudinary : new LocalStorage();
  logInfo(`Storage provider resolved: ${cached.provider}`);
  return cached;
}

export function storageProviderStatus(): {
  active: StorageProvider;
  demoMode: boolean;
} {
  const provider = resolveStorageProvider();
  return { active: provider.provider, demoMode: provider.provider === "local" };
}

export function resetStorageProvider(): void {
  cached = null;
}
