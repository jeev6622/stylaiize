/**
 * Temporary verification script (task: Gemini configuration check).
 * Run: npx tsx scripts/verify-gemini.ts   (from apps/api)
 * Never prints the API key value.
 */
import { env } from "../src/config/env";
import { aiProviderStatus, resolveAIProvider } from "../src/infrastructure/ai/factory";

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function main(): Promise<void> {
  log("--- Gemini configuration ---");
  log(`AI_PROVIDER: ${JSON.stringify(env.AI_PROVIDER)}`);
  log(`GEMINI_MODEL: ${env.GEMINI_MODEL}`);
  log(
    `GEMINI_API_KEY: ${env.GEMINI_API_KEY.trim().length > 0 ? "PRESENT" : "MISSING"}`,
  );
  log(`dotenv loaded .env from cwd: ${process.cwd()}`);

  const status = aiProviderStatus();
  log(
    `aiProviderStatus -> active=${status.active} configured=${status.configured} demoMode=${status.demoMode}`,
  );

  let provider;
  try {
    provider = resolveAIProvider();
    log(`resolveAIProvider -> ${provider.name} (${provider.description})`);
    log(`isConfigured: ${provider.isConfigured}`);
  } catch (err) {
    log(`resolveAIProvider THREW: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }

  log("--- Real Gemini request ---");
  try {
    const res = await provider.chat({
      messages: [
        { role: "system", content: "You are a terse assistant." },
        { role: "user", content: "Reply with exactly: OK" },
      ],
      maxOutputTokens: 512,
      temperature: 0,
    });
    log(`chat() -> SUCCESS`);
    log(`model text: ${JSON.stringify(res.text.slice(0, 200))}`);
    log(
      `usage: in=${res.usage?.inputTokens} out=${res.usage?.outputTokens}`,
    );
  } catch (err) {
    log(`chat() -> FAILED`);
    log(
      `actual provider error: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = 1;
  }

  try {
    let streamed = "";
    for await (const chunk of provider.stream({
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      maxOutputTokens: 512,
      temperature: 0,
    })) {
      streamed += chunk;
    }
    log(`stream() -> SUCCESS chunks text: ${JSON.stringify(streamed.slice(0, 120))}`);
  } catch (err) {
    log(`stream() -> FAILED`);
    log(
      `actual provider error: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = 1;
  }
}

void main();
