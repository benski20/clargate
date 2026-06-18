import type { AiTask, ModelAssignment, ProviderName } from "./types";

const DEFAULT_ROUTING: Record<AiTask, ModelAssignment> = {
  "category-prediction":   { provider: "azure-openai", model: "gpt-5.4" },
  "compliance-flags":      { provider: "azure-openai", model: "gpt-5.4" },
  "board-reviewer":        { provider: "azure-openai", model: "gpt-5.4" },
  "board-synthesis":       { provider: "azure-openai", model: "gpt-5.4" },
  "admin-summary":         { provider: "azure-openai", model: "gpt-5.4" },

  "intake-chat":           { provider: "gemini", model: "" },
  "intake-chat-stream":    { provider: "gemini", model: "" },
  "upload-assistant":      { provider: "gemini", model: "" },
  "upload-assistant-stream": { provider: "gemini", model: "" },
  "consent-generation":    { provider: "azure-openai", model: "gpt-5.4" },
  "protocol-synthesis":    { provider: "azure-openai", model: "gpt-5.4" },
  "revision-suggestions":  { provider: "azure-openai", model: "gpt-5.4" },
  "revision-letter":       { provider: "azure-openai", model: "gpt-5.4" },
  "file-extraction":       { provider: "gemini", model: "" },
};

const VALID_PROVIDERS = new Set<ProviderName>(["gemini", "azure-openai", "openai"]);

function parseOverride(value: string): ModelAssignment | undefined {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex === -1) return undefined;
  const provider = value.slice(0, separatorIndex) as ProviderName;
  const model = value.slice(separatorIndex + 1);
  if (!VALID_PROVIDERS.has(provider) || !model) return undefined;
  return { provider, model };
}

export function getModelForTask(task: AiTask): ModelAssignment {
  const envKey = `AI_TASK_${task.toUpperCase().replace(/-/g, "_")}`;
  const envValue = process.env[envKey]?.trim();
  if (envValue) {
    const override = parseOverride(envValue);
    if (override) return override;
  }
  return DEFAULT_ROUTING[task];
}

export function isAzureOpenAiConfigured(): boolean {
  return Boolean(
    process.env.AZURE_OPENAI_API_KEY?.trim() &&
    process.env.AZURE_OPENAI_ENDPOINT?.trim(),
  );
}
