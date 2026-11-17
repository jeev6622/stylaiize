import { getDatabaseStatus } from "@/config/mongodb";
import type { Conversation } from "@stylaiize/shared";
import { ConversationModel, toConversation } from "@/infrastructure/db/models/conversation.model";
import type {
  ConversationRepository,
  CreateConversationInput,
} from "@/domain/ports/repositories";

/**
 * Mongoose-backed conversation repository.
 * Used whenever MongoDB is connected; otherwise callers use the
 * in-memory demo repository.
 */
export class MongoConversationRepository implements ConversationRepository {
  async create(input: CreateConversationInput): Promise<Conversation> {
    const doc = await ConversationModel.create({
      userId: input.userId ?? null,
      title: input.title ?? "New conversation",
      messages: [],
    });
    return toConversation(doc);
  }

  async findById(id: string): Promise<Conversation | null> {
    const doc = await ConversationModel.findById(id);
    return doc ? toConversation(doc) : null;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Conversation | null> {
    const doc = await ConversationModel.findOne({ _id: id, userId });
    return doc ? toConversation(doc) : null;
  }

  async findByUserId(userId: string): Promise<Conversation[]> {
    const docs = await ConversationModel.find({ userId }).sort({ updatedAt: -1 });
    return docs.map(toConversation);
  }

  async countAll(): Promise<number> {
    return ConversationModel.countDocuments();
  }

  async update(
    id: string,
    patch: Partial<Pick<Conversation, "title" | "messages">>,
  ): Promise<Conversation | null> {
    const updateDoc: Record<string, unknown> = {};
    if (patch.title !== undefined) updateDoc.title = patch.title;
    if (patch.messages !== undefined) updateDoc.messages = patch.messages;
    const doc = await ConversationModel.findByIdAndUpdate(
      id,
      { $set: updateDoc },
      { new: true, runValidators: true },
    );
    return doc ? toConversation(doc) : null;
  }

  async delete(id: string): Promise<void> {
    await ConversationModel.findByIdAndDelete(id);
  }
}

/** Returns the appropriate conversation repository for the current database state. */
export function conversationRepository(): ConversationRepository {
  const db = getDatabaseStatus();
  if (!db.demoMode) return mongoConversationRepository;
  return demoConversationRepository ?? mongoConversationRepository;
}

let demoConversationRepository: ConversationRepository | null = null;

export function registerDemoConversationRepository(repo: ConversationRepository): void {
  demoConversationRepository = repo;
}

const mongoConversationRepository = new MongoConversationRepository();
