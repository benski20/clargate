import type { AiTask, ProviderAdapter } from "./types";
import { getModelForTask, isAzureOpenAiConfigured } from "./config";
import { createGeminiAdapter } from "./adapters/gemini";
import { createAzureOpenAiAdapter } from "./adapters/azure-openai";

const adapterCache = new Map<string, ProviderAdapter>();

function getAdapter(provider: string, model: string): ProviderAdapter {
  const cacheKey = `${provider}:${model}`;
  const cached = adapterCache.get(cacheKey);
  if (cached) return cached;

  let adapter: ProviderAdapter;
  switch (provider) {
    case "azure-openai":
      adapter = createAzureOpenAiAdapter(model);
      break;
    case "gemini":
      adapter = createGeminiAdapter(model || undefined);
      break;
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }

  adapterCache.set(cacheKey, adapter);
  return adapter;
}

function resolveAdapter(task: AiTask): { adapter: ProviderAdapter; provider: string; model: string } {
  const assignment = getModelForTask(task);
  let { provider, model } = assignment;

  if (provider === "azure-openai" && !isAzureOpenAiConfigured()) {
    provider = "gemini";
    model = "";
  }

  const adapter = getAdapter(provider, model);
  return { adapter, provider, model };
}

export function resolveProviderForTask(task: AiTask): string {
  const { provider, model } = resolveAdapter(task);
  return model ? `${provider}:${model}` : provider;
}

export function generateWithForcedToolCall<T extends object>(
  task: AiTask,
  params: Parameters<ProviderAdapter["generateWithForcedToolCall"]>[0],
): Promise<T> {
  const { adapter } = resolveAdapter(task);
  return adapter.generateWithForcedToolCall<T>(params);
}

export function generatePlainText(
  task: AiTask,
  params: Parameters<ProviderAdapter["generatePlainText"]>[0],
): Promise<string> {
  const { adapter } = resolveAdapter(task);
  return adapter.generatePlainText(params);
}

export function generateMultiTurnText(
  task: AiTask,
  params: Parameters<ProviderAdapter["generateMultiTurnText"]>[0],
): Promise<string> {
  const { adapter } = resolveAdapter(task);
  return adapter.generateMultiTurnText(params);
}

export function generateMultiTurnTextStream(
  task: AiTask,
  params: Parameters<ProviderAdapter["generateMultiTurnTextStream"]>[0],
): AsyncGenerator<string, void, void> {
  const { adapter } = resolveAdapter(task);
  return adapter.generateMultiTurnTextStream(params);
}
