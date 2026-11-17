import { conversationRepository } from "@/infrastructure/repos/conversation.repo";
import { wardrobeRepository } from "@/infrastructure/repos/wardrobe.repo";
import { priceAlertRepository } from "@/infrastructure/repos/price-alert.repo";
import { calendarRepository } from "@/infrastructure/repos/calendar.repo";
import { countSavedOutfits } from "@/application/services/saved-outfit.service";

export interface DashboardSummary {
  conversations: number;
  savedOutfits: number;
  wardrobeItems: number;
  alerts: number;
  events: number;
}

/**
 * Aggregates per-user counts for the dashboard landing page.
 * Every promise is individually caught so one failing store never
 * takes the whole dashboard down.
 */
export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const convRepo = conversationRepository();
  const alertRepo = priceAlertRepository();
  const calRepo = calendarRepository();

  const [conversations, savedOutfits, wardrobeItems, alerts, events] = await Promise.all([
    convRepo.findByUserId(userId).then((c) => c.length).catch(() => 0),
    // Collections that expose a dedicated count are counted in the database
    // rather than by hydrating every document into memory.
    countSavedOutfits(userId).catch(() => 0),
    wardrobeRepository()
      .countByUserId(userId)
      .catch(() => 0),
    alertRepo.findByUserId(userId).then((a) => a.length).catch(() => 0),
    calRepo.findByUserId(userId).then((c) => c.length).catch(() => 0),
  ]);

  return { conversations, savedOutfits, wardrobeItems, alerts, events };
}