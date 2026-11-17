import { createApp } from "@/app";
import { connectToDatabase, disconnectDatabase, getDatabaseStatus } from "@/config/mongodb";
import { env } from "@/config/env";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { registerDemoOTPRepository } from "@/infrastructure/repos/otp.repo";
import { InMemoryOTPRepository } from "@/infrastructure/repos/memory/otp.memory.repo";
import { registerDemoRefreshTokenRepository } from "@/infrastructure/repos/refresh-token.repo";
import { InMemoryRefreshTokenRepository } from "@/infrastructure/repos/memory/refresh-token.memory.repo";
import { registerDemoConversationRepository } from "@/infrastructure/repos/conversation.repo";
import { InMemoryConversationRepository } from "@/infrastructure/repos/memory/conversation.memory.repo";
import { registerDemoWardrobeRepository } from "@/infrastructure/repos/wardrobe.repo";
import { InMemoryWardrobeRepository } from "@/infrastructure/repos/memory/wardrobe.memory.repo";
import { registerDemoCalendarRepository } from "@/infrastructure/repos/calendar.repo";
import { InMemoryCalendarRepository } from "@/infrastructure/repos/memory/calendar.memory.repo";
import { registerDemoPackingListRepository } from "@/infrastructure/repos/packing.repo";
import { InMemoryPackingListRepository } from "@/infrastructure/repos/memory/packing.memory.repo";
import { registerDemoSavedOutfitRepository } from "@/infrastructure/repos/saved-outfit.repo";
import { InMemorySavedOutfitRepository } from "@/infrastructure/repos/memory/saved-outfit.memory.repo";
import { registerDemoFashionMemoryRepository } from "@/infrastructure/repos/fashion-memory.repo";
import { InMemoryFashionMemoryRepository } from "@/infrastructure/repos/memory/fashion-memory.memory.repo";
import { registerDemoPriceAlertRepository } from "@/infrastructure/repos/price-alert.repo";
import { InMemoryPriceAlertRepository } from "@/infrastructure/repos/memory/price-alert.memory.repo";
import { registerDemoTryOnResultRepository } from "@/infrastructure/repos/try-on-result.repo";
import { InMemoryTryOnResultRepository } from "@/infrastructure/repos/memory/try-on-result.memory.repo";
import { logInfo } from "@/utils/logger";

async function bootstrap(): Promise<void> {
  const app = createApp();

  const db = await connectToDatabase();
  if (db.demoMode) {
    registerDemoUserRepository(new InMemoryUserRepository());
    registerDemoConversationRepository(new InMemoryConversationRepository());
    registerDemoWardrobeRepository(new InMemoryWardrobeRepository());
    registerDemoCalendarRepository(new InMemoryCalendarRepository());
    registerDemoPackingListRepository(new InMemoryPackingListRepository());
    registerDemoSavedOutfitRepository(new InMemorySavedOutfitRepository());
    registerDemoFashionMemoryRepository(new InMemoryFashionMemoryRepository());
    registerDemoPriceAlertRepository(new InMemoryPriceAlertRepository());
    registerDemoTryOnResultRepository(new InMemoryTryOnResultRepository());
    registerDemoOTPRepository(new InMemoryOTPRepository());
    registerDemoRefreshTokenRepository(new InMemoryRefreshTokenRepository());
    logInfo("All in-memory demo repositories registered.");
  } else {
    logInfo("Using MongoDB repositories.");
  }

  const server = app.listen(env.PORT, () => {
    logInfo(`StylAIze API listening on ${env.API_PUBLIC_URL} (${env.NODE_ENV})`);
    logInfo(
      `Providers -> AI: ${getDatabaseStatus().demoMode ? "mock" : "configured"} | DB: ${getDatabaseStatus().demoMode ? "demo" : "mongodb"}`,
    );
  });

  const shutdown = async (signal: string) => {
    logInfo(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error during bootstrap:", err);
  process.exit(1);
});
