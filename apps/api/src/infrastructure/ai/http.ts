/**
 * Shared HTTP plumbing for AI providers.
 * Uses the global fetch (Node >= 20).
 */
import { AIProviderError } from "./errors";
import type { AIRequest, AITask } from "./provider.interface";

export interface OpenAICompatibleOptions {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string | Array<Record<string, unknown>>;
  }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
  stream?: boolean;
}

/** Aborts a fetch that has no response headers within `ms`. */
export const AI_REQUEST_TIMEOUT_MS = 60_000;

/** Aborts a streaming fetch that stays silent for longer than `ms`. */
export const AI_STREAM_IDLE_TIMEOUT_MS = 45_000;

/**
 * Yields the `data:` payload of each SSE frame, stopping at `[DONE]`.
 * Shared by every provider that streams. Also supports CRLF line endings.
 *
 * `idleTimeoutMs` aborts a provider that stops sending bytes for that long
 * while the connection stays open (a total-timeout would kill legitimate long
 * generations; this only fires when the stream stalls).
 */
export async function* parseSseData(
  body: ReadableStream<Uint8Array>,
  idleTimeoutMs: number = AI_STREAM_IDLE_TIMEOUT_MS,
): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await readWithIdleTimeout(reader, idleTimeoutMs);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line. Both LF and CRLF are common.
      let split = buffer.indexOf("\n\n");
      if (split === -1) {
        split = buffer.indexOf("\r\n\r\n");
      }
      while (split !== -1) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + (buffer[split] === "\r" ? 4 : 2));
        const payload = readFramePayload(frame);
        if (payload === "[DONE]") return;
        if (payload) yield payload;
        split = buffer.indexOf("\n\n");
        if (split === -1) {
          split = buffer.indexOf("\r\n\r\n");
        }
      }
    }
    const tail = readFramePayload(buffer);
    if (tail && tail !== "[DONE]") yield tail;
  } finally {
    // Releasing lets an aborted/abandoned stream tear the socket down.
    reader.releaseLock();
  }
}

/**
 * Reads the next chunk, failing when no bytes arrive within `idleTimeoutMs`.
 * The name matches `AbortError` so existing timeout handling maps it to a
 * readable "timed out" message.
 */
async function readWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleTimeoutMs: number,
): Promise<Awaited<ReturnType<typeof reader.read>>> {
  if (idleTimeoutMs <= 0) return reader.read();

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const err = new Error("Stream idle timeout");
      err.name = "AbortError";
      reject(err);
    }, idleTimeoutMs);
  });

  try {
    return await Promise.race([reader.read(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function readFramePayload(frame: string): string {
  const normalized = frame.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const data: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return data.join("\n");
}

/** Converts an image part to an OpenAI-style data-URL content part. */
function imageToDataUrl(mimeType: string, data: string): string {
  return `data:${mimeType};base64,${data}`;
}

/** Builds the OpenAI-compatible `messages` array (images on the last user turn). */
function toOpenAiMessages(req: AIRequest): ChatCompletionRequest["messages"] {
  const out: ChatCompletionRequest["messages"] = [];
  const turns = req.messages.filter((m) => m.role !== "system");
  const imageTarget = turns.reduce(
    (acc, m, i) => (m.role === "user" ? i : acc),
    -1,
  );

  let turnIndex = -1;
  for (const m of req.messages) {
    if (m.role === "system") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    turnIndex += 1;

    if (turnIndex !== imageTarget || (req.images?.length ?? 0) === 0) {
      out.push({ role: m.role, content: m.content });
      continue;
    }

    const parts: Array<Record<string, unknown>> = [{ type: "text", text: m.content }];
    for (const img of req.images ?? []) {
      parts.push({
        type: "image_url",
        image_url: { url: imageToDataUrl(img.mimeType, img.data) },
      });
    }
    out.push({ role: m.role, content: parts });
  }

  return out;
}

/** A stable fingerprint so logs/tests can identify a provider. */
export function taskLabel(task: AITask): string {
  return task;
}

export async function openAiCompatibleChat(
  options: OpenAICompatibleOptions,
  req: AIRequest,
): Promise<{ text: string; raw: unknown }> {
  const body: ChatCompletionRequest = {
    model: options.model,
    messages: toOpenAiMessages(req),
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxOutputTokens ?? 2048,
    ...(req.json ? { response_format: { type: "json_object" } } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(completionsUrl(options), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new AIProviderError(
        options.name,
        `HTTP ${res.status}: ${detail.slice(0, 500)}`,
      );
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    return { text, raw: json };
  } catch (err) {
    throw toProviderError(options.name, err, "chat completion");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Streams an OpenAI-compatible chat completion, yielding text deltas as they
 * arrive. Used for chat so the client sees tokens as they are produced.
 */
export async function* openAiCompatibleStream(
  options: OpenAICompatibleOptions,
  req: AIRequest,
): AsyncGenerator<string, void, unknown> {
  const body: ChatCompletionRequest = {
    model: options.model,
    messages: toOpenAiMessages(req),
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxOutputTokens ?? 2048,
    stream: true,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(completionsUrl(options), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    throw toProviderError(options.name, err, "stream connect");
  }

  if (!res.ok) {
    clearTimeout(timeout);
    const detail = await res.text().catch(() => "");
    throw new AIProviderError(
      options.name,
      `HTTP ${res.status}: ${detail.slice(0, 500)}`,
    );
  }
  if (!res.body) {
    clearTimeout(timeout);
    throw new AIProviderError(options.name, "Streaming response had no body.");
  }

  try {
    for await (const payload of parseSseData(res.body)) {
      let frame: {
        choices?: Array<{ delta?: { content?: string } }>;
        error?: { message?: string };
      };
      try {
        frame = JSON.parse(payload) as typeof frame;
      } catch {
        continue; // keep-alive or non-JSON frame
      }
      if (frame.error?.message) {
        throw new AIProviderError(options.name, frame.error.message);
      }
      const delta = frame.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  } catch (err) {
    throw toProviderError(options.name, err, "stream");
  } finally {
    clearTimeout(timeout);
  }
}

function completionsUrl(options: OpenAICompatibleOptions): string {
  return `${options.baseUrl.replace(/\/$/, "")}/chat/completions`;
}

/** Turns an abort/timeout into a readable provider error. */
function toProviderError(name: string, err: unknown, phase: string): unknown {
  if (err instanceof AIProviderError) return err;
  if (err instanceof Error && err.name === "AbortError") {
    return new AIProviderError(name, `Request timed out during ${phase}.`);
  }
  return new AIProviderError(
    name,
    `Network failure during ${phase}: ${err instanceof Error ? err.message : String(err)}`,
  );
}

export function extractJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
      } catch {
        // fall through
      }
    }
    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        return JSON.parse(trimmed.slice(objectStart, objectEnd + 1)) as Record<
          string,
          unknown
        >;
      } catch {
        // fall through
      }
    }
    return {};
  }
}
