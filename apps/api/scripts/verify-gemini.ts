/**
 * Temporary verification script (task: Gemini configuration check).
 * Run: npx tsx scripts/verify-gemini.ts   (from apps/api)
 * Never prints the API key value.
 */
import { env } from "../src/config/env";
import { aiProviderStatus, resolveAIProvider } from "../src/infrastructure/ai/factory";

async function main(): Promise<void> {
  console.log("--- Gemini configuration ---");
  console.log(`AI_PROVIDER: ${JSON.stringify(env.AI_PROVIDER)}`);
  console.log(`GEMINI_MODEL: ${env.GEMINI_MODEL}`);
  console.log(
    `GEMINI_API_KEY: ${env.GEMINI_API_KEY.trim().length > 0 ? "PRESENT" : "MISSING"}`,
  );
  console.log(`dotenv loaded .env from cwd: ${process.cwd()}`);

  const status = aiProviderStatus();
  console.log(
    `aiProviderStatus -> active=${status.active} configured=${status.configured} demoMode=${status.demoMode}`,
  );

  let provider;
  try {
    provider = resolveAIProvider();
    console.log(`resolveAIProvider -> ${provider.name} (${provider.description})`);
    console.log(`isConfigured: ${provider.isConfigured}`);
  } catch (err) {
    console.log(`resolveAIProvider THREW: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }

  console.log("--- Real Gemini request ---");
  try {
    const res = await provider.chat({
      messages: [
        { role: "system", content: "You are a terse assistant." },
        { role: "user", content: "Reply with exactly: OK" },
      ],
      maxOutputTokens: 512,
      temperature: 0,
    });
    console.log(`chat() -> SUCCESS`);
    console.log(`model text: ${JSON.stringify(res.text.slice(0, 200))}`);
    console.log(
      `usage: in=${res.usage?.inputTokens} out=${res.usage?.outputTokens}`,
    );
  } catch (err) {
    console.log(`chat() -> FAILED`);
    console.log(
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
    console.log(`stream() -> SUCCESS chunks text: ${JSON.stringify(streamed.slice(0, 120))}`);
  } catch (err) {
    console.log(`stream() -> FAILED`);
    console.log(
      `actual provider error: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = 1;
  }
}

void main();
