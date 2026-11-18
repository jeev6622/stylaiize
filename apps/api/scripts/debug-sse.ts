/** Temporary debug: raw SSE frames from Gemini streaming. */
import { env } from "../src/config/env";

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:streamGenerateContent?alt=sse`;
const body = {
  contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }],
  generationConfig: { temperature: 0, maxOutputTokens: 32 },
};

async function main(): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "x-goog-api-key": env.GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });
  log(`status=${res.status}`);
  if (!res.ok) {
    log(`error body: ${(await res.text()).slice(0, 300)}`);
    return;
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  log(`RAW FRAMES:\n${raw.slice(0, 1500)}`);
}

void main();
