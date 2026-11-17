import type { AlertChannel, CalendarEvent, Conversation, EventCategory, FashionMemory, GroomingPlan, OTPRecord, OutfitCategory, OutfitItem, OutfitScores, PackingList, PriceAlert, PriceAlertCondition, RefreshTokenRecord, SavedOutfit, SavedOutfitSource, TryOnResultRecord, User, VTONProvider, WardrobeItem, WardrobeCategory } from "@stylaiize/shared";

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash?: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
  mobile?: string | null;
  countryCode?: string | null;
}

export interface UserRepository {
  create(input: CreateUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  findByMobile(countryCode: string, mobile: string): Promise<User | null>;
  findByMobileLower(mobileLower: string): Promise<User | null>;
  listAll(options?: { page?: number; limit?: number; role?: string; search?: string }): Promise<{ users: User[]; total: number }>;
  count(): Promise<number>;
  update(id: string, patch: Partial<Pick<User, "name" | "avatarUrl" | "emailVerified" | "mobile" | "countryCode" | "mobileVerified" | "preferences" | "passwordHash" | "googleId" | "providers" | "role">>): Promise<User | null>;
  delete(id: string): Promise<void>;
}

export interface OTPRepository {
  create(record: OTPRecord): Promise<void>;
  findActive(target: string, purpose: string): Promise<OTPRecord | null>;
  findByTarget(target: string, purpose: string): Promise<OTPRecord | null>;
  incrementAttempts(id: string): Promise<void>;
  markUsed(id: string): Promise<void>;
  deleteExpired(): Promise<void>;
}

export interface RefreshTokenRepository {
  create(record: RefreshTokenRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeAllForUser(userId: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
  deleteExpired(): Promise<void>;
}

export interface CreateConversationInput {
  userId: string | null;
  title?: string;
}

export interface ConversationRepository {
  create(input: CreateConversationInput): Promise<Conversation>;
  findById(id: string): Promise<Conversation | null>;
  findByIdAndUserId(id: string, userId: string): Promise<Conversation | null>;
  findByUserId(userId: string): Promise<Conversation[]>;
  countAll(): Promise<number>;
  update(id: string, patch: Partial<Pick<Conversation, "title" | "messages">>): Promise<Conversation | null>;
  delete(id: string): Promise<void>;
}

export interface CreateWardrobeItemInput {
  userId: string;
  name: string;
  category: WardrobeCategory;
  color: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  brand?: string | null;
  purchasedPrice?: number | null;
  tags?: string[];
}

export interface WardrobeRepository {
  create(input: CreateWardrobeItemInput): Promise<WardrobeItem>;
  findById(id: string): Promise<WardrobeItem | null>;
  findByUserId(userId: string): Promise<WardrobeItem[]>;
  findByUserIdAndCategory(userId: string, category: WardrobeCategory): Promise<WardrobeItem[]>;
  countAll(): Promise<number>;
  countByUserId(userId: string): Promise<number>;
  update(id: string, patch: Partial<Pick<WardrobeItem, "name" | "category" | "color" | "imageUrl" | "imagePublicId" | "brand" | "purchasedPrice" | "timesWorn" | "lastWornAt" | "tags">>): Promise<WardrobeItem | null>;
  /**
   * Atomically record one wear: increments `timesWorn`, sets `lastWornAt` and
   * recomputes `costPerWear`. Returns null when the item does not exist.
   * A read-then-write would lose concurrent wears.
   */
  incrementWear(id: string, wornAt: string): Promise<WardrobeItem | null>;
  delete(id: string): Promise<void>;
}

export interface CreateCalendarEventInput {
  userId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  eventCategory?: EventCategory | null;
  dressCode?: string | null;
  reminderDays?: number[];
}

export interface CalendarRepository {
  create(input: CreateCalendarEventInput): Promise<CalendarEvent>;
  findById(id: string): Promise<CalendarEvent | null>;
  findByUserId(userId: string): Promise<CalendarEvent[]>;
  findByUserIdAndDateRange(userId: string, start: string, end: string): Promise<CalendarEvent[]>;
  update(id: string, patch: Partial<Pick<CalendarEvent, "title" | "startsAt" | "endsAt" | "location" | "eventCategory" | "dressCode" | "isOutfitPlanned" | "reminderDays">>): Promise<CalendarEvent | null>;
  delete(id: string): Promise<void>;
}

export interface CreatePackingListInput {
  userId: string;
  title: string;
  destination: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface PackingListRepository {
  create(input: CreatePackingListInput): Promise<PackingList>;
  findById(id: string): Promise<PackingList | null>;
  findByIdAndUserId(id: string, userId: string): Promise<PackingList | null>;
  findByUserId(userId: string): Promise<PackingList[]>;
  update(id: string, patch: Partial<Pick<PackingList, "title" | "destination" | "startDate" | "endDate" | "items" | "weatherBasedAdjustments" | "activities">>): Promise<PackingList | null>;
  delete(id: string): Promise<void>;
}

export interface CreateSavedOutfitInput {
  userId: string;
  name: string;
  category: OutfitCategory;
  occasion?: string | null;
  style?: string | null;
  colors?: string[];
  budget?: number | null;
  items: OutfitItem[];
  scores?: OutfitScores | null;
  totalCost?: number | null;
  imageUrl?: string | null;
  explanation?: string | null;
  grooming?: GroomingPlan | null;
  source?: SavedOutfitSource;
}

export interface SavedOutfitRepository {
  create(input: CreateSavedOutfitInput): Promise<SavedOutfit>;
  findById(id: string): Promise<SavedOutfit | null>;
  findByUserId(userId: string): Promise<SavedOutfit[]>;
  update(id: string, patch: Partial<Pick<SavedOutfit, "name" | "category" | "occasion" | "style" | "colors" | "budget" | "items" | "scores" | "totalCost" | "imageUrl" | "explanation" | "grooming">>): Promise<SavedOutfit | null>;
  delete(id: string): Promise<void>;
  countByUserId(userId: string): Promise<number>;
}

export type FashionMemoryPatch = Partial<
  Omit<FashionMemory, "id" | "userId">
>;

export interface FashionMemoryRepository {
  findByUserId(userId: string): Promise<FashionMemory | null>;
  upsert(userId: string, patch: FashionMemoryPatch): Promise<FashionMemory>;
}

export interface CreatePriceAlertInput {
  userId: string;
  productId: string;
  targetPrice: number;
  conditions: PriceAlertCondition[];
  channels: AlertChannel[];
}
export interface PriceAlertRepository {
  create(input: CreatePriceAlertInput): Promise<PriceAlert>;
  findById(id: string): Promise<PriceAlert | null>;
  findByUserId(userId: string): Promise<PriceAlert[]>;
  findByStatus(status: PriceAlert["status"]): Promise<PriceAlert[]>;
  update(id: string, patch: Partial<Pick<PriceAlert, "targetPrice" | "conditions" | "channels" | "status" | "triggeredAt">>): Promise<PriceAlert | null>;
  delete(id: string): Promise<void>;
}

export interface CreateTryOnResultInput {
  userId: string;
  provider: VTONProvider;
  category?: string | null;
  personImage: string;
  garmentImage: string;
  garmentLabel?: string | null;
  resultImage?: string | null;
  mimeType?: string | null;
  sourceUrl?: string | null;
  processingTimeMs?: number | null;
}

export interface TryOnResultRepository {
  create(input: CreateTryOnResultInput): Promise<TryOnResultRecord>;
  findById(id: string): Promise<TryOnResultRecord | null>;
  findByUserId(userId: string): Promise<TryOnResultRecord[]>;
  delete(id: string): Promise<void>;
}
