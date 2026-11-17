import { userRepository } from "@/infrastructure/repos/user.repo";
import { conversationRepository } from "@/infrastructure/repos/conversation.repo";
import { wardrobeRepository } from "@/infrastructure/repos/wardrobe.repo";
import type { User } from "@stylaiize/shared";

export interface AdminStats {
  totalUsers: number;
  totalConversations: number;
  totalWardrobeItems: number;
  recentUsers: User[];
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

  return { totalUsers, totalConversations, totalWardrobeItems, recentUsers };
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
