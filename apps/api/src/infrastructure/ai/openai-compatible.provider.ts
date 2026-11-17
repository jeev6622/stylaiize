import { env } from "@/config/env";
import type { AIProvider } from "@stylaiize/shared";
import { openAiCompatibleChat, openAiCompatibleStream } from "./http";
import { AINotConfiguredError } from "./errors";
import type { AIProviderPort, AIRequest, AIResponse } from "./provider.interface";

interface CompatibleConfig {
  name: AIProvider;
  description: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

function makeProvider(cfg: CompatibleConfig, isConfigured: () => boolean): AIProviderPort {
  const options = {
    name: cfg.name,
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    model: cfg.model,
  };

  return {
    name: cfg.name,
    description: cfg.description,
    get isConfigured() {
      return isConfigured();
    },
    async chat(req: AIRequest): Promise<AIResponse> {
      if (!this.isConfigured) {
        throw new AINotConfiguredError(cfg.name);
      }
      const { text, raw } = await openAiCompatibleChat(options, req);
      return { text, raw };
    },
    async *stream(req: AIRequest): AsyncGenerator<string, void, unknown> {
      if (!isConfigured()) {
        throw new AINotConfiguredError(cfg.name);
      }
      yield* openAiCompatibleStream(options, req);
    },
  };
}

import {
  isGemmaConfigured,
  isLlamaConfigured,
  isOpenAIConfigured,
  isQwenConfigured,
} from "@/config/features";

export const OpenAIProvider = makeProvider(
  {
    name: "openai",
    description: "OpenAI GPT-4o (vision)",
    baseUrl: "https://api.openai.com/v1",
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
  },
  () => isOpenAIConfigured,
);

export const QwenProvider = makeProvider(
  {
    name: "qwen",
    description: "Qwen2.5-VL (DashScope OpenAI-compatible)",
    baseUrl: env.QWEN_BASE_URL,
    apiKey: env.QWEN_API_KEY,
    model: env.QWEN_MODEL,
  },
  () => isQwenConfigured,
);

export const LlamaProvider = makeProvider(
  {
    name: "llama",
    description: "Llama Vision (RunPod / Modal / vLLM)",
    baseUrl: env.LLAMA_BASE_URL,
    apiKey: env.LLAMA_API_KEY,
    model: env.LLAMA_MODEL,
  },
  () => isLlamaConfigured,
);

export const GemmaProvider = makeProvider(
  {
    name: "gemma",
    description: "Gemma (RunPod / Modal / vLLM)",
    baseUrl: env.GEMMA_BASE_URL,
    apiKey: env.GEMMA_API_KEY,
    model: env.GEMMA_MODEL,
  },
  () => isGemmaConfigured,
);
