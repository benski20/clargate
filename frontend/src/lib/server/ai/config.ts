import type { AiTask, ModelAssignment, ProviderName } from "./types";

const DEFAULT_ROUTING: Record<AiTask, ModelAssignment> = {
  "category-prediction":   { provider: "azure-arbiter", model: "gpt-5.4-pro" },
  "compliance-flags":      { provider: "azure-openai", model: "gpt-5.4" },
  "board-reviewer":        { provider: "azure-openai", model: "gpt-5.4" },
  "board-synthesis":       { provider: "azure-openai", model: "gpt-5.4" },
  "admin-summary":         { provider: "azure-openai", model: "gpt-5.4" },

  "intake-chat":           { provider: "azure-foundry", model: "model-router" },
  "intake-chat-stream":    { provider: "azure-foundry", model: "model-router" },
  "upload-assistant":      { provider: "azure-foundry", model: "model-router" },
  "upload-assistant-stream": { provider: "azure-foundry", model: "model-router" },
  "consent-generation":    { provider: "azure-openai", model: "gpt-5.4" },
  "protocol-synthesis":    { provider: "azure-openai", model: "gpt-5.4" },
  "revision-suggestions":  { provider: "azure-openai", model: "gpt-5.4" },
  "revision-letter":       { provider: "azure-openai", model: "gpt-5.4" },
  "file-extraction":       { provider: "azure-openai", model: "gpt-5.4" },

  "questionnaire-analyze":      { provider: "azure-foundry",    model: "model-router" },
  "questionnaire-chat":         { provider: "azure-foundry",    model: "model-router" },
  "questionnaire-chat-stream":  { provider: "azure-foundry",    model: "model-router" },
};

const VALID_PROVIDERS = new Set<ProviderName>(["gemini", "azure-openai", "azure-arbiter", "azure-foundry", "azure-submission", "openai"]);

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

export function isAzureFoundryConfigured(): boolean {
  return Boolean(
    process.env.AZURE_ARBITER_API_KEY?.trim() &&
    process.env.AZURE_ARBITER_ENDPOINT?.trim(),
  );
}

export function isSubmissionAgentConfigured(): boolean {
  return Boolean(
    process.env.AZURE_SUBMISSION_AGENT_NAME?.trim() &&
    (process.env.AZURE_SUBMISSION_AGENT_ENDPOINT?.trim() ||
      process.env.AZURE_ARBITER_ENDPOINT?.trim()) &&
    process.env.AZURE_ARBITER_TENANT_ID?.trim() &&
    process.env.AZURE_ARBITER_CLIENT_ID?.trim() &&
    process.env.AZURE_ARBITER_CLIENT_SECRET?.trim(),
  );
}

export function isAzureArbiterConfigured(): boolean {
  return Boolean(
    process.env.AZURE_ARBITER_ENDPOINT?.trim() &&
    process.env.AZURE_ARBITER_TENANT_ID?.trim() &&
    process.env.AZURE_ARBITER_CLIENT_ID?.trim() &&
    process.env.AZURE_ARBITER_CLIENT_SECRET?.trim(),
  );
}
