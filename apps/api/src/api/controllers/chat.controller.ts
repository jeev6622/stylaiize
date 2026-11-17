import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { ChatMessage } from "@stylaiize/shared";
import { asyncHandler, ok, created } from "@/utils/async-handler";
import { AppError, NotFoundError } from "@/utils/errors";
import { logError } from "@/utils/logger";
import { aiService } from "@/application/services/ai.service";
import { buildUserContext } from "@/application/services/chat-context.service";
import { conversationRepository } from "@/infrastructure/repos/conversation.repo";
import type { AIChatMessage } from "@/infrastructure/ai/provider.interface";
import type { SendMessageInput } from "@/api/validators/chat.schema";

/** How many recent messages are replayed to the model as context. */
const CHAT_HISTORY_TURNS = 20;

/** Keeps the newest `limit` messages, preserving order. */
function recentTurns(messages: ChatMessage[], limit: number): ChatMessage[] {
  return messages.length <= limit ? messages : messages.slice(-limit);
}

/** GET /chat/conversations — list current user's conversations */
export const listConversationsController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id ?? null;
  if (!userId) {
    ok(res, { conversations: [] });
    return;
  }
  const conversations = await conversationRepository().findByUserId(userId);
  const summaries = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    messageCount: c.messages.length,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
  ok(res, { conversations: summaries });
});

/** POST /chat/conversations — create a new conversation */
export const createConversationController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id ?? null;
  const repo = conversationRepository();
  const conversation = await repo.create({
    userId,
    title: (req.body as { title?: string }).title ?? "New conversation",
  });
  created(res, { conversation });
});

/** GET /chat/conversations/:id — get a conversation with messages */
export const getConversationController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new NotFoundError("Conversation not found.");
  const repo = conversationRepository();
  const conversation = await repo.findByIdAndUserId(req.params.id, userId);
  if (!conversation) throw new NotFoundError("Conversation not found.");
  ok(res, { conversation });
});

/** DELETE /chat/conversations/:id — delete a conversation */
export const deleteConversationController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new NotFoundError("Conversation not found.");
  const repo = conversationRepository();
  const conversation = await repo.findByIdAndUserId(req.params.id, userId);
  if (!conversation) throw new NotFoundError("Conversation not found.");
  await repo.delete(req.params.id);
  ok(res, { deleted: true });
});

/**
 * POST /chat — send a message and receive a response.
 * Supports both JSON and SSE streaming via `?stream=true`.
 */
export const sendMessageController = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as SendMessageInput;
  const userId = req.user?.id ?? null;
  const stream = req.query.stream === "true";
  const repo = conversationRepository();

  let conversationId = input.conversationId;
  // Conversations are only reachable by the authenticated owner. When no
  // user is present, an existing conversation can never be attached to.
  let conversation = conversationId
    ? userId
      ? await repo.findByIdAndUserId(conversationId, userId)
      : null
    : null;

  if (input.conversationId && !conversation) {
    throw new NotFoundError("Conversation not found.");
  }

  if (!conversation) {
    const title = input.content.length > 60
      ? `${input.content.slice(0, 57)}...`
      : input.content;
    conversation = await repo.create({ userId, title });
    conversationId = conversation.id;
  }

  const userMessage: ChatMessage = {
    id: randomUUID(),
    role: "user",
    content: input.content,
    context: {},
    images: input.images ?? [],
    createdAt: new Date().toISOString(),
  };

  conversation.messages.push(userMessage);
  await repo.update(conversationId!, { messages: conversation.messages });

  // Bound the history sent to the model: only the most recent turns matter for
  // style continuity, and unbounded history blows the context window/cost.
  const history = recentTurns(conversation.messages, CHAT_HISTORY_TURNS);

  // Real wardrobe/profile/memory context, read from the database.
  const userContext = await buildUserContext(userId);

  const aiMessages: AIChatMessage[] = [];
  if (userContext) {
    aiMessages.push({
      role: "system",
      content:
        "This is the signed-in user's real data. Use it to personalise every " +
        "recommendation: prefer clothes they already own, respect their sizes, " +
        "favorite colours/brands and budget. Never contradict this data.\n\n" +
        userContext,
    });
  }
  for (const m of history) {
    aiMessages.push({ role: m.role, content: m.content });
  }

  // Only the turn just sent may carry images forward. Re-sending an old image
  // would answer the new question with stale visual context.
  const aiImages = userMessage.images;

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("X-Conversation-Id", conversationId!);
    res.flushHeaders();

    let fullText = "";
    // The client may hang up mid-stream. Persist whatever was produced so the
    // reply is not lost, and stop writing to a closed socket.
    let clientGone = false;
    const onClose = () => {
      clientGone = true;
    };
    res.on("close", onClose);

    try {
      for await (const chunk of aiService.chatStream({ messages: aiMessages, images: aiImages })) {
        if (clientGone) break;
        fullText = chunk.fullText;
        res.write(`data: ${JSON.stringify({ type: "token", content: chunk.delta })}\n\n`);
      }

      if (!clientGone) {
        res.write(`data: ${JSON.stringify({ type: "done", conversationId: conversationId! })}\n\n`);
      }
    } catch (err) {
      logError("AI chat generation failed (stream)", err instanceof Error ? err : new Error(String(err)));
      if (!clientGone) {
        // Surface the real reason instead of a generic failure string.
        const message =
          err instanceof AppError ? err.message : "Failed to generate a response. Please try again.";
        res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
      }
    } finally {
      res.off("close", onClose);
      if (fullText) {
        conversation.messages.push({
          id: randomUUID(),
          role: "assistant",
          content: fullText,
          context: {},
          images: [],
          createdAt: new Date().toISOString(),
        });
        await repo.update(conversationId!, { messages: conversation.messages });
      }
      if (!res.writableEnded) res.end();
    }

    return;
  }

  const result = await aiService.chat({ messages: aiMessages, images: aiImages });

  const assistantMessage: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content: result.text,
    context: {},
    images: [],
    createdAt: new Date().toISOString(),
  };

  conversation.messages.push(assistantMessage);
  await repo.update(conversationId!, { messages: conversation.messages });

  ok(res, {
    conversationId,
    message: assistantMessage,
  });
});
