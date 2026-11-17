import { getDatabaseStatus } from "@/config/mongodb";
import type { User } from "@stylaiize/shared";
import { toUser, UserModel } from "@/infrastructure/db/models/user.model";
import type {
  CreateUserInput,
  UserRepository,
} from "@/domain/ports/repositories";

/**
 * Mongoose-backed user repository.
 * Used whenever MongoDB is connected; otherwise callers use the
 * in-memory demo repository.
 */
export class MongoUserRepository implements UserRepository {
  async create(input: CreateUserInput): Promise<User> {
    const doc = await UserModel.create({
      name: input.name,
      email: input.email,
      emailLower: input.email.toLowerCase(),
      mobile: input.mobile ?? null,
      countryCode: input.countryCode ?? null,
      mobileLower: input.mobile && input.countryCode ? `${input.countryCode}${input.mobile}`.toLowerCase() : null,
      mobileVerified: false,
      passwordHash: input.passwordHash ?? null,
      googleId: input.googleId ?? null,
      avatarUrl: input.avatarUrl ?? null,
      emailVerified: input.emailVerified ?? false,
      providers: input.googleId ? ["google"] : ["email"],
    });
    return toUser(doc);
  }

  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findById(id);
    return doc ? toUser(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ emailLower: email.toLowerCase() });
    return doc ? toUser(doc) : null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const doc = await UserModel.findOne({ googleId });
    return doc ? toUser(doc) : null;
  }

  async findByMobile(countryCode: string, mobile: string): Promise<User | null> {
    const doc = await UserModel.findOne({ countryCode, mobile });
    return doc ? toUser(doc) : null;
  }

  async findByMobileLower(mobileLower: string): Promise<User | null> {
    const doc = await UserModel.findOne({ mobileLower: mobileLower.toLowerCase() });
    return doc ? toUser(doc) : null;
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
    const updateDoc: Record<string, unknown> = { $set: patch };
    if (patch.mobile !== undefined || patch.countryCode !== undefined) {
      const existing = await UserModel.findById(id);
      if (existing) {
        const m = patch.mobile !== undefined ? patch.mobile : existing.mobile;
        const cc = patch.countryCode !== undefined ? patch.countryCode : existing.countryCode;
        updateDoc.$set = {
          ...updateDoc.$set as Record<string, unknown>,
          mobileLower: m && cc ? `${cc}${m}`.toLowerCase() : null,
        };
      }
    }
    const doc = await UserModel.findByIdAndUpdate(
      id,
      updateDoc,
      { new: true, runValidators: true },
    );
    return doc ? toUser(doc) : null;
  }

  async listAll(options?: { page?: number; limit?: number; role?: string; search?: string }): Promise<{ users: User[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (options?.role) filter.role = options.role;
    if (options?.search) {
      const regex = new RegExp(options.search, "i");
      filter.$or = [{ name: regex }, { email: regex }];
    }
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const total = await UserModel.countDocuments(filter);
    const docs = await UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const users = docs.map(toUser);
    return { users, total };
  }

  async count(): Promise<number> {
    return UserModel.countDocuments();
  }

  async delete(id: string): Promise<void> {
    await UserModel.findByIdAndDelete(id);
  }
}

/** Returns the appropriate user repository for the current database state. */
export function userRepository(): UserRepository {
  const db = getDatabaseStatus();
  if (!db.demoMode) return mongoUserRepository;
  // Demo mode: delegated to in-memory store registered at bootstrap.
  return demoUserRepository ?? mongoUserRepository;
}

let demoUserRepository: UserRepository | null = null;

export function registerDemoUserRepository(repo: UserRepository): void {
  demoUserRepository = repo;
}

const mongoUserRepository = new MongoUserRepository();
