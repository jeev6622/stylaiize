"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, Loader2, ImagePlus, X, Copy, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import {
  API_BASE_URL,
  getAccessToken,
  getRefreshToken,
  setTokens,
  apiClient,
} from "@/lib/api";
import { API_ENDPOINTS, type ChatMessage, type Conversation } from "@stylaiize/shared";

interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ImagePreview {
  file: File;
  preview: string;
  base64: string;
}

const MAX_IMAGES = 4;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ChatPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [imagesMap, setImagesMap] = useState<Record<string, Array<{ mimeType: string; data: string }>>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []);

  async function loadConversations() {
    try {
      const data = await apiClient.get<{ conversations: ConversationSummary[] }>(
        API_ENDPOINTS.chat.conversations
      );
      setConversations(data.conversations);
    } catch {
      // Silent fail for conversation list
    }
  }

  async function selectConversation(id: string) {
    try {
      const data = await apiClient.get<{ conversation: Conversation }>(
        `${API_ENDPOINTS.chat.conversations}/${id}`
      );
      setActiveConversationId(id);
      setMessages(data.conversation.messages);

      const newImagesMap: Record<string, Array<{ mimeType: string; data: string }>> = {};
      for (const msg of data.conversation.messages) {
        if (msg.role === "user" && msg.images && msg.images.length > 0) {
          newImagesMap[msg.id] = msg.images;
        }
      }
      setImagesMap(newImagesMap);
    } catch {
      toast.error("Failed to load conversation.");
    }
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setImagePreviews([]);
    textareaRef.current?.focus();
  }

  async function deleteConversation(id: string) {
    setDeletingId(id);
    try {
      await apiClient.delete(`${API_ENDPOINTS.chat.conversations}/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        startNewConversation();
      }
      toast.success("Conversation deleted.");
    } catch {
      toast.error("Failed to delete conversation.");
    } finally {
      setDeletingId(null);
    }
  }

  async function copyMessage(content: string, id: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy.");
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_IMAGES - imagePreviews.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);

    for (const file of filesToProcess) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name} is not a supported image type. Use JPEG, PNG, or WebP.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 5MB limit.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        const preview = URL.createObjectURL(file);
        setImagePreviews((prev) => [...prev, { file, preview, base64 }]);
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeImage(index: number) {
    setImagePreviews((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function sendMessage() {
    const content = input.trim();
    if ((!content && imagePreviews.length === 0) || isLoading) return;

    const imagesPayload = imagePreviews.map((p) => ({
      mimeType: p.file.type,
      data: p.base64,
    }));

    setInput("");
    setImagePreviews([]);
    setIsLoading(true);
    setIsStreaming(true);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      context: {},
      images: imagesPayload.length > 0 ? imagesPayload : undefined,
      createdAt: new Date().toISOString(),
    };

    if (imagesPayload.length > 0) {
      setImagesMap((prev) => ({ ...prev, [userMessage.id]: imagesPayload }));
    }

    setMessages((prev) => [...prev, userMessage]);

    try {
      const token = getAccessToken();
      if (!token) {
        toast.error("Please sign in to chat.");
        return;
      }

      const params = new URLSearchParams({ stream: "true" });
      const res = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.chat.base}?${params}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            content,
            ...(activeConversationId ? { conversationId: activeConversationId } : {}),
            images: imagesPayload.length > 0 ? imagesPayload : undefined,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const convId = res.headers.get("X-Conversation-Id");
      if (convId && !activeConversationId) {
        setActiveConversationId(convId);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream.");

      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          context: {},
          createdAt: new Date().toISOString(),
        },
      ]);

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "token" && event.content) {
                assistantContent += event.content;
                const capturedContent = assistantContent;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: capturedContent }
                      : m
                  )
                );
              } else if (event.type === "done") {
                if (event.conversationId && !activeConversationId) {
                  setActiveConversationId(event.conversationId);
                }
              } else if (event.type === "error") {
                toast.error(event.message || "AI response failed.");
                setMessages((prev) => prev.filter((m) => m.id !== assistantId));
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      }

      if (assistantContent) {
        await loadConversations();
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast.error(
        detail ? `Failed to send message: ${detail}` : "Failed to send message. Please try again."
      );
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  const canSend = input.trim() || imagePreviews.length > 0;

  return (
    <div className="flex h-full">
      {/* Sidebar: Conversations */}
      <div className="hidden w-64 flex-col border-r border-border bg-card/30 md:flex">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-sm font-semibold">Conversations</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={startNewConversation}
            className="h-8 px-2"
          >
            <Sparkles className="h-4 w-4" />
            <span className="ml-1">New</span>
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 px-2 pb-4">
            {conversations.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No conversations yet.
              </p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center rounded-lg transition-colors ${
                  activeConversationId === conv.id
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <button
                  onClick={() => void selectConversation(conv.id)}
                  className="flex-1 truncate px-3 py-2 text-left text-sm"
                >
                  {conv.title}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteConversation(conv.id);
                  }}
                  disabled={deletingId === conv.id}
                  className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                  title="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Mobile conversation list */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={startNewConversation}
            className="h-8"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            New chat
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="mx-auto max-w-3xl py-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-4 rounded-full bg-primary/10 p-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  Hi {user?.name?.split(" ")[0] ?? "there"}!
                </h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  I&apos;m your AI fashion stylist. Tell me where you&apos;re going and
                  I&apos;ll help you build the perfect outfit.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {[
                    "I have a wedding this weekend",
                    "Need an interview outfit",
                    "What should I wear on a date?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-full border border-border bg-secondary/50 px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Sparkles className="h-3 w-3" />
                        StylAIze
                        <button
                          onClick={() => void copyMessage(msg.content, msg.id)}
                          className="ml-auto rounded p-0.5 transition-colors hover:text-foreground"
                          title="Copy message"
                        >
                          {copiedId === msg.id ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    )}
                    {msg.role === "user" && imagesMap[msg.id] && imagesMap[msg.id].length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {imagesMap[msg.id].map((img, i) => (
                          <img
                            key={i}
                            src={`data:${img.mimeType};base64,${img.data}`}
                            alt={`Uploaded image ${i + 1}`}
                            className="h-20 w-20 rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    )}
                    {msg.role === "assistant" ? (
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          code: ({ children, className }) => {
                            const isInline = !className;
                            return isInline ? (
                              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{children}</code>
                            ) : (
                              <code className="block overflow-x-auto rounded bg-muted p-3 text-xs">{children}</code>
                            );
                          },
                          h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-bold mb-2">{children}</h3>,
                          a: ({ children, href }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{children}</a>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic mb-2">{children}</blockquote>
                          ),
                        }}
                      >
                        {msg.content}
                      </Markdown>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && isStreaming && messages.length > 0 && messages[messages.length - 1]?.content === "" && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border bg-background/80 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl">
            {/* Image previews */}
            {imagePreviews.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {imagePreviews.map((img, i) => (
                  <div key={i} className="relative">
                    <img
                      src={img.preview}
                      alt={`Preview ${i + 1}`}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card/50 p-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || imagePreviews.length >= MAX_IMAGES}
                title="Upload image"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell me about your event..."
                className="min-h-[44px] flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                rows={1}
                disabled={isLoading}
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={() => void sendMessage()}
                disabled={!canSend || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              StylAIze AI can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
