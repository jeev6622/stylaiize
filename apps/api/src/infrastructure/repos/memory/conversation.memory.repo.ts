import { randomUUID } from "node:crypto";
import type { Conversation } from "@stylaiize/shared";
import type {
  ConversationRepository,
  CreateConversationInput,
} from "@/domain/ports/repositories";

/**
 * In-memory conversation repository for demo mode (no MongoDB configured).
 * Data is intentionally not persisted across restarts.
 */
export class InMemoryConversationRepository implements ConversationRepository {
  private readonly conversations = new Map<string, Conversation>();

  async create(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: randomUUID(),
      userId: input.userId,
      title: input.title ?? "New conversation",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(conversation.id, structuredClone(conversation));
    return structuredClone(conversation);
  }

  async findById(id: string): Promise<Conversation | null> {
    const c = this.conversations.get(id);
    return c ? structuredClone(c) : null;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Conversation | null> {
    const c = this.conversations.get(id);
    if (!c || c.userId !== userId) return null;
    return structuredClone(c);
  }

  async findByUserId(userId: string): Promise<Conversation[]> {
    const results: Conversation[] = [];
    for (const c of this.conversations.values()) {
      if (c.userId === userId) results.push(structuredClone(c));
    }
    return results.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async countAll(): Promise<number> {
    return this.conversations.size;
  }

  async update(
    id: string,
    patch: Partial<Pick<Conversation, "title" | "messages">>,
  ): Promise<Conversation | null> {
    const existing = this.conversations.get(id);
    if (!existing) return null;
    const updated: Conversation = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.conversations.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async delete(id: string): Promise<void> {
    this.conversations.delete(id);
  }
}
