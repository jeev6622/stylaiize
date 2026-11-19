import type { DashboardActivity, DashboardSummary, Product } from "@stylaiize/shared";
import { conversationRepository } from "@/infrastructure/repos/conversation.repo";
import { savedOutfitRepository } from "@/infrastructure/repos/saved-outfit.repo";
import { wardrobeRepository } from "@/infrastructure/repos/wardrobe.repo";
import { priceAlertRepository } from "@/infrastructure/repos/price-alert.repo";
import { calendarRepository } from "@/infrastructure/repos/calendar.repo";
import { userRepository } from "@/infrastructure/repos/user.repo";
import { getNotificationStatus } from "@/application/services/account.service";

const RECENT_LIMIT = 5;

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const [conversations, outfits, wardrobeItems, alerts, events, user, notifications] =
    await Promise.all([
      conversationRepository().findByUserId(userId),
      savedOutfitRepository().findByUserId(userId),
      wardrobeRepository().countByUserId(userId),
      priceAlertRepository().findByUserId(userId),
      calendarRepository().findByUserId(userId),
      userRepository().findById(userId),
      getNotificationStatus(userId),
    ]);

  const favouriteProducts: Product[] = user?.preferences?.favoriteProducts ?? [];

  const recentConversations = [...conversations]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, RECENT_LIMIT)
    .map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
    }));

  const recentOutfits = [...outfits]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, RECENT_LIMIT)
    .map((outfit) => ({
      id: outfit.id,
      name: outfit.name,
      occasion: outfit.occasion ?? null,
      createdAt: outfit.createdAt,
    }));

  const recentActivity: DashboardActivity[] = [
    ...conversations.map((conversation) => ({
      id: `conversation:${conversation.id}`,
      type: "conversation" as const,
      title: conversation.title,
      at: conversation.updatedAt,
      href: `/chat`,
    })),
    ...outfits.map((outfit) => ({
      id: `outfit:${outfit.id}`,
      type: "outfit" as const,
      title: outfit.name,
      at: outfit.createdAt,
      href: `/outfits`,
    })),
    ...alerts.map((alert) => ({
      id: `alert:${alert.id}`,
      type: "alert" as const,
      title: "Price alert",
      at: alert.triggeredAt ?? alert.createdAt,
      href: `/alerts`,
    })),
    ...events.map((event) => ({
      id: `event:${event.id}`,
      type: "event" as const,
      title: event.title,
      at: event.startsAt,
      href: `/calendar`,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, RECENT_LIMIT);

  return {
    conversations: conversations.length,
    savedOutfits: outfits.length,
    wardrobeItems,
    alerts: alerts.length,
    events: events.length,
    favourites: favouriteProducts.length,
    recentConversations,
    recentOutfits,
    favouriteProducts,
    recentActivity,
    notifications,
  };
}