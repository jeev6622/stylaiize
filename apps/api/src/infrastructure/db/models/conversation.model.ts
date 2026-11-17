import { Schema, model, models } from "mongoose";
import type { Conversation } from "@stylaiize/shared";

export interface ConversationDocument {
  userId: string | null;
  title: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    images?: Array<{ mimeType: string; data: string }>;
    context: Record<string, unknown>;
    createdAt: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSubschema = new Schema(
  {
    id: { type: String, required: true },
    role: { type: String, required: true },
    content: { type: String, required: true },
    images: [{ mimeType: String, data: String }],
    context: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: String, required: true },
  },
  { _id: false },
);

const ConversationSchema = new Schema<ConversationDocument>(
  {
    userId: { type: String, default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    messages: [MessageSubschema],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const obj = ret as unknown as Record<string, unknown>;
        obj.id = String(obj._id);
        delete obj._id;
        delete obj.__v;
        return obj;
      },
    },
  },
);

export const ConversationModel =
  models.Conversation ?? model<ConversationDocument>("Conversation", ConversationSchema);

export function toConversation(doc: ConversationDocument & { _id: unknown }): Conversation {
  return {
    id: doc._id?.toString() ?? "",
    userId: doc.userId ?? null,
    title: doc.title,
    messages: (doc.messages ?? []).map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      images: m.images ?? [],
      context: m.context ?? {},
      createdAt: m.createdAt,
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
