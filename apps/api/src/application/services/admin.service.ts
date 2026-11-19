import { userRepository } from "@/infrastructure/repos/user.repo";
import { conversationRepository } from "@/infrastructure/repos/conversation.repo";
import { wardrobeRepository } from "@/infrastructure/repos/wardrobe.repo";
import { getDatabaseStatus } from "@/config/mongodb";
import { aiProviderStatus } from "@/infrastructure/ai/factory";
import { emailProviderStatus } from "@/infrastructure/email/factory";
import { shoppingProviderStatus } from "@/infrastructure/shopping/factory";
import { notificationProviderStatus } from "@/infrastructure/notifications/factory";
import { storageProviderStatus } from "@/infrastructure/storage/factory";
import { vtonProviderStatus } from "@/infrastructure/vton/factory";
import type { ProviderStatus, User } from "@stylaiize/shared";

export interface AdminStats {
  totalUsers: number;
  totalConversations: number;
  totalWardrobeItems: number;
  recentUsers: User[];
  providers: ProviderStatus;
  uptime: number;
}

export async function getStats(): Promise<AdminStats> {
  const userRepo = userRepository();
  const convRepo = conversationRepository();
  const wardrobeRepo = wardrobeRepository();

  const [totalUsers, totalConversations, totalWardrobeItems, { users: recentUsers }] = await Promise.all([
    userRepo.count(),
    convRepo.countAll().catch(() => 0),
    wardrobeRepo.countAll().catch(() => 0),
    userRepo.listAll({ limit: 5 }),
  ]);

  const db = getDatabaseStatus();
  const vton = vtonProviderStatus();
  const providers: ProviderStatus = {
    ai: aiProviderStatus(),
    database: { active: db.connected, demoMode: db.demoMode },
    storage: storageProviderStatus(),
    vton: { active: vton.active ?? "none", demoMode: vton.demoMode },
    email: emailProviderStatus(),
    shopping: shoppingProviderStatus(),
    notification: notificationProviderStatus(),
  };

  return {
    totalUsers,
    totalConversations,
    totalWardrobeItems,
    recentUsers,
    providers,
    uptime: process.uptime(),
  };
}

export async function listUsers(options: { page?: number; limit?: number; role?: string; search?: string }) {
  return userRepository().listAll(options);
}

export async function getUser(id: string): Promise<User | null> {
  return userRepository().findById(id);
}

export async function updateUserRole(id: string, role: "user" | "admin"): Promise<User | null> {
  return userRepository().update(id, { role });
}

export async function deleteUser(id: string): Promise<void> {
  await userRepository().delete(id);
}
