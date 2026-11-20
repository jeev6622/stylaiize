import { randomUUID } from "node:crypto";
import type { User } from "@stylaiize/shared";
import type {
  CreateUserInput,
  UserRepository,
} from "@/domain/ports/repositories";
import { ConflictError, NotFoundError } from "@/utils/errors";

function defaultPreferences(): User["preferences"] {
  return {
    budgetRange: null,
    favoriteColors: [],
    favoriteBrands: [],
    sizes: {},
    stylePreferences: [],
    notificationChannels: ["email"],
    emailNotifications: true,
    pushNotifications: false,
    deviceTokens: [],
    units: "metric",
    favoriteProducts: [],
  };
}

/**
 * In-memory user repository for demo mode (no MongoDB configured).
 * Data is intentionally not persisted across restarts.
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async create(input: CreateUserInput): Promise<User> {
    if (await this.findByEmail(input.email)) {
      throw new ConflictError("An account with this email already exists.", "EMAIL_TAKEN");
    }
    if (input.mobile && input.countryCode && await this.findByMobile(input.countryCode, input.mobile)) {
      throw new ConflictError("An account with this mobile number already exists.", "MOBILE_TAKEN");
    }
    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      name: input.name,
      email: input.email.toLowerCase(),
      mobile: input.mobile ?? null,
      countryCode: input.countryCode ?? null,
      avatarUrl: input.avatarUrl ?? null,
      role: "user",
      emailVerified: input.emailVerified ?? false,
      mobileVerified: input.mobileVerified ?? false,
      providers: input.googleId ? ["google"] : ["email"],
      googleId: input.googleId ?? null,
      passwordHash: input.passwordHash ?? null,
      gender: null,
      preferences: defaultPreferences(),
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return structuredClone(user);
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? structuredClone(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const lower = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === lower) return structuredClone(user);
    }
    return null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.googleId === googleId) return structuredClone(user);
    }
    return null;
  }

  async findByMobile(countryCode: string, mobile: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.countryCode === countryCode && user.mobile === mobile) return structuredClone(user);
    }
    return null;
  }

  async findByMobileLower(mobileLower: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.countryCode && user.mobile) {
        const combined = `${user.countryCode}${user.mobile}`.toLowerCase();
        if (combined === mobileLower) return structuredClone(user);
      }
    }
    return null;
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        User,
        "name" | "avatarUrl" | "emailVerified" | "mobile" | "countryCode" | "mobileVerified" | "preferences" | "passwordHash" | "googleId" | "providers" | "role"
      >
    >,
  ): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) throw new NotFoundError("User not found.");
    const updated: User = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, updated);
    return structuredClone(updated);
  }

  async listAll(options?: { page?: number; limit?: number; role?: string; search?: string }): Promise<{ users: User[]; total: number }> {
    let result = Array.from(this.users.values());

    if (options?.role) {
      result = result.filter((u) => u.role === options.role);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      result = result.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = result.length;
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const start = (page - 1) * limit;
    const users = result.slice(start, start + limit).map((u) => structuredClone(u));

    return { users, total };
  }

  async count(): Promise<number> {
    return this.users.size;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
}
