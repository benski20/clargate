import type { ProviderAdapter, JsonSchemaProperty, ToolDefinition } from "../types";

type ChatMessage = { role: "user" | "assistant"; content: string };

export type AzureOpenAiConfig = {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
};

export function getDefaultAzureConfig(): AzureOpenAiConfig {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  if (!endpoint || !apiKey) {
    throw new Error("AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must be set");
  }
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim() || "v1";
  return { endpoint, apiKey, apiVersion };
}

function normalizeEndpoint(endpoint: string): string {
  let base = endpoint.replace(/\/+$/, "");
  base = base.replace(/\/api\/projects\/[^/]+.*$/, "");
  return base;
}

function buildChatCompletionsUrl(config: AzureOpenAiConfig): string {
  const base = normalizeEndpoint(config.endpoint);
  return `${base}/openai/v1/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`;
}

function toJsonSchema(property: JsonSchemaProperty): Record<string, unknown> {
  const result: Record<string, unknown> = { type: property.type };
  if (property.description) result.description = property.description;
  if (property.enum) result.enum = property.enum;
  if (property.items) result.items = toJsonSchema(property.items);
  if (property.properties) {
    result.properties = Object.fromEntries(
      Object.entries(property.properties).map(([key, value]) => [key, toJsonSchema(value)]),
    );
    result.required = Object.keys(property.properties);
  } else if (property.required) {
    result.required = property.required;
  }
  result.additionalProperties = false;
  return result;
}

function toOpenAiTool(tool: ToolDefinition): Record<string, unknown> {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toJsonSchema(tool.parameters),
      strict: true,
    },
  };
}

function toOpenAiMessages(
  systemInstruction: string,
  history: ChatMessage[],
  userText: string,
): Array<Record<string, string>> {
  const messages: Array<Record<string, string>> = [
    { role: "system", content: systemInstruction },
  ];
  for (const message of history) {
    messages.push({ role: message.role, content: message.content });
  }
  messages.push({ role: "user", content: userText });
  return messages;
}

type CompletionResponse = {
  error?: { message?: string };
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
};

async function postCompletion(
  config: AzureOpenAiConfig,
  deployment: string,
  body: Record<string, unknown>,
): Promise<CompletionResponse> {
  const response = await fetch(buildChatCompletionsUrl(config), {
    method: "POST",
    headers: {
      "api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: deployment, ...body }),
  });

  const json = (await response.json()) as CompletionResponse;
  if (!response.ok) {
    throw new Error(json.error?.message || `Azure OpenAI request failed (${response.status})`);
  }
  return json;
}

export function createAzureOpenAiAdapter(
  deployment: string,
  configOverride?: AzureOpenAiConfig,
): ProviderAdapter {
  const resolveConfig = () => configOverride ?? getDefaultAzureConfig();
  const useReasoning = !deployment.startsWith("model-router");

  return {
    async generateWithForcedToolCall<T extends object>({
      systemInstruction,
      history,
      userText,
      tool,
      maxOutputTokens = 8192,
    }: Parameters<ProviderAdapter["generateWithForcedToolCall"]>[0]) {
      const json = await postCompletion(resolveConfig(), deployment, {
        messages: toOpenAiMessages(systemInstruction, history, userText),
        max_completion_tokens: maxOutputTokens,
        ...(useReasoning && { reasoning_effort: "medium" as const }),
        tools: [toOpenAiTool(tool)],
        tool_choice: { type: "function", function: { name: tool.name } },
      });

      const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments || toolCall.function.name !== tool.name) {
        throw new Error("model_did_not_return_tool");
      }
      return JSON.parse(toolCall.function.arguments) as T;
    },

    async generatePlainText({
      systemInstruction,
      userText,
      temperature = 0.4,
      maxOutputTokens = 8192,
    }: Parameters<ProviderAdapter["generatePlainText"]>[0]) {
      const json = await postCompletion(resolveConfig(), deployment, {
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userText },
        ],
        temperature,
        max_completion_tokens: maxOutputTokens,
        ...(useReasoning && { reasoning_effort: "medium" as const }),
      });

      const text = json.choices?.[0]?.message?.content;
      if (!text?.trim()) throw new Error("Empty model response");
      return text.trim();
    },

    async generateMultiTurnText({
      systemInstruction,
      history,
      userText,
      temperature = 0.35,
      maxOutputTokens = 4096,
    }: Parameters<ProviderAdapter["generateMultiTurnText"]>[0]) {
      const json = await postCompletion(resolveConfig(), deployment, {
        messages: toOpenAiMessages(systemInstruction, history, userText),
        temperature,
        max_completion_tokens: maxOutputTokens,
        ...(useReasoning && { reasoning_effort: "medium" as const }),
      });

      const text = json.choices?.[0]?.message?.content;
      if (!text?.trim()) throw new Error("Empty model response");
      return text.trim();
    },

    async *generateMultiTurnTextStream({
      systemInstruction,
      history,
      userText,
      temperature = 0.35,
      maxOutputTokens = 4096,
    }: Parameters<ProviderAdapter["generateMultiTurnTextStream"]>[0]) {
      const config = resolveConfig();
      const response = await fetch(buildChatCompletionsUrl(config), {
        method: "POST",
        headers: {
          "api-key": config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: deployment,
          messages: toOpenAiMessages(systemInstruction, history, userText),
          temperature,
          max_completion_tokens: maxOutputTokens,
          ...(useReasoning && { reasoning_effort: "medium" as const }),
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Azure OpenAI stream failed (${response.status}): ${errorBody}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body for streaming");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") return;

          const chunk = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) yield content;
        }
      }
    },
  };
}
