import type { ProviderStatus } from "@stylaiize/shared";
import { getDatabaseStatus } from "@/config/mongodb";
import { aiProviderStatus } from "@/infrastructure/ai/factory";
import { emailProviderStatus } from "@/infrastructure/email/factory";
import { shoppingProviderStatus } from "@/infrastructure/shopping/factory";
import { notificationProviderStatus } from "@/infrastructure/notifications/factory";
import { storageProviderStatus } from "@/infrastructure/storage/factory";
import { vtonProviderStatus } from "@/infrastructure/vton/factory";
import type { Request, Response } from "express";
import { asyncHandler, ok } from "@/utils/async-handler";

export const healthController = asyncHandler(async (_req: Request, res: Response) => {
  const db = getDatabaseStatus();
  const ai = aiProviderStatus();
  const storage = storageProviderStatus();
  const email = emailProviderStatus();
  const vton = vtonProviderStatus();

  const providers: ProviderStatus = {
    ai,
    database: { active: db.connected, demoMode: db.demoMode },
    storage,
    vton: { active: vton.active ?? "none", demoMode: vton.demoMode },
    email,
    shopping: shoppingProviderStatus(),
    notification: notificationProviderStatus(),
  };

  ok(res, {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    providers,
  });
});

/** Bare liveness probe for orchestrators/load balancers. */
export const livenessController = (_req: Request, res: Response) => {
  res.status(200).send("ok");
};
