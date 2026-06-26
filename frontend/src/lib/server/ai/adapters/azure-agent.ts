import { AIProjectClient } from "@azure/ai-projects";
import { ClientSecretCredential } from "@azure/identity";
import type OpenAI from "openai";
import type { ProviderAdapter, ToolDefinition, JsonSchemaProperty } from "../types";

type ChatMessage = { role: "user" | "assistant"; content: string };

export type AzureAgentConfig = {
  endpoint: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
};

let cachedClient: OpenAI | null = null;
let cachedConfigKey = "";

function isHostedAgent(): boolean {
  return Boolean(process.env.AZURE_ARBITER_AGENT_NAME?.trim());
}

function getOpenAIClient(config: AzureAgentConfig): OpenAI {
  const key = `${config.tenantId}:${config.clientId}:${config.endpoint}`;
  if (cachedClient && cachedConfigKey === key) return cachedClient;

  const credential = new ClientSecretCredential(
    config.tenantId,
    config.clientId,
    config.clientSecret,
  );
  const project = new AIProjectClient(config.endpoint, credential);
  const agentName = process.env.AZURE_ARBITER_AGENT_NAME?.trim() || "";
  cachedClient = project.getOpenAIClient({
    azureConfig: { allowPreview: true, agentName },
    timeout: 5 * 60 * 1000,
  });
  cachedConfigKey = key;
  return cachedClient;
}

function toFunctionToolSchema(property: JsonSchemaProperty): Record<string, unknown> {
  const result: Record<string, unknown> = { type: property.type };
  if (property.description) result.description = property.description;
  if (property.enum) result.enum = property.enum;
  if (property.items) result.items = toFunctionToolSchema(property.items);
  if (property.properties) {
    result.properties = Object.fromEntries(
      Object.entries(property.properties).map(([key, value]) => [
        key,
        toFunctionToolSchema(value),
      ]),
    );
    result.required = Object.keys(property.properties);
  } else if (property.required) {
    result.required = property.required;
  }
  result.additionalProperties = false;
  return result;
}

function getInlineTools(): OpenAI.Responses.Tool[] {
  if (isHostedAgent()) return [];
  const vectorStoreId = process.env.AZURE_ARBITER_VECTOR_STORE_ID?.trim();
  const tools: OpenAI.Responses.Tool[] = [{ type: "web_search" }];
  if (vectorStoreId) {
    tools.push({ type: "file_search", vector_store_ids: [vectorStoreId] });
  }
  return tools;
}

function buildInput(
  history: ChatMessage[],
  userText: string,
): OpenAI.Responses.ResponseInput {
  const items: OpenAI.Responses.ResponseInputItem[] = [];
  for (const message of history) {
    items.push({ role: message.role, content: message.content });
  }
  items.push({ role: "user", content: userText });
  return items;
}

export function getAgentConfig(): AzureAgentConfig {
  const endpoint = process.env.AZURE_ARBITER_ENDPOINT?.trim();
  const tenantId = process.env.AZURE_ARBITER_TENANT_ID?.trim();
  const clientId = process.env.AZURE_ARBITER_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_ARBITER_CLIENT_SECRET?.trim();

  if (!endpoint || !tenantId || !clientId || !clientSecret) {
    throw new Error(
      "AZURE_ARBITER_ENDPOINT, AZURE_ARBITER_TENANT_ID, AZURE_ARBITER_CLIENT_ID, and AZURE_ARBITER_CLIENT_SECRET must be set",
    );
  }
  return { endpoint, tenantId, clientId, clientSecret };
}

export function isAzureAgentConfigured(): boolean {
  return Boolean(
    process.env.AZURE_ARBITER_ENDPOINT?.trim() &&
      process.env.AZURE_ARBITER_TENANT_ID?.trim() &&
      process.env.AZURE_ARBITER_CLIENT_ID?.trim() &&
      process.env.AZURE_ARBITER_CLIENT_SECRET?.trim(),
  );
}

export function createAzureAgentAdapter(model: string): ProviderAdapter {
  const hosted = isHostedAgent();
  const effectiveModel = hosted
    ? (process.env.AZURE_ARBITER_AGENT_MODEL?.trim() || model)
    : model;

  return {
    async generateWithForcedToolCall<T extends object>({
      systemInstruction,
      history,
      userText,
      tool,
    }: Parameters<ProviderAdapter["generateWithForcedToolCall"]>[0]) {
      const config = getAgentConfig();
      const client = getOpenAIClient(config);

      if (hosted) {
        const jsonPrompt = `\n\nYou MUST respond with a single JSON object matching this schema (no markdown, no code fences, no extra text):\n${JSON.stringify(toFunctionToolSchema(tool.parameters), null, 2)}`;
        const stream = await client.responses.create({
          model: effectiveModel,
          stream: true,
          input: buildInput(history, userText + jsonPrompt),
        });

        let fullText = "";
        for await (const event of stream) {
          if (event.type === "response.output_text.delta") fullText += event.delta ?? "";
        }

        const cleaned = fullText.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "");
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]) as T;
        throw new Error("Agent did not return valid JSON");
      }

      const functionTool: OpenAI.Responses.Tool = {
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: toFunctionToolSchema(tool.parameters),
        strict: true,
      };

      const stream = await client.responses.create({
        model: effectiveModel,
        stream: true,
        instructions: systemInstruction,
        input: buildInput(history, userText),
        tools: [...getInlineTools(), functionTool],
        tool_choice: { type: "function", name: tool.name },
      });

      let functionArgs = "";
      let functionName = "";
      let fullText = "";

      for await (const event of stream) {
        if (event.type === "response.function_call_arguments.delta") {
          functionArgs += event.delta ?? "";
        } else if (event.type === "response.output_item.added") {
          const item = event.item;
          if (item.type === "function_call") {
            functionName = item.name ?? "";
            functionArgs = "";
          }
        } else if (event.type === "response.output_text.delta") {
          fullText += event.delta ?? "";
        }
      }

      if (functionName === tool.name && functionArgs) {
        return JSON.parse(functionArgs) as T;
      }

      if (fullText) {
        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]) as T;
      }

      throw new Error("Agent did not return structured tool output");
    },

    async generatePlainText({
      systemInstruction,
      userText,
    }: Parameters<ProviderAdapter["generatePlainText"]>[0]) {
      const config = getAgentConfig();
      const client = getOpenAIClient(config);

      const stream = await client.responses.create({
        model: effectiveModel,
        stream: true,
        ...(!hosted && { instructions: systemInstruction }),
        input: userText,
        ...(!hosted && { tools: getInlineTools() }),
      });

      let text = "";
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") text += event.delta ?? "";
      }

      if (!text.trim()) throw new Error("Empty agent response");
      return text.trim();
    },

    async generateMultiTurnText({
      systemInstruction,
      history,
      userText,
    }: Parameters<ProviderAdapter["generateMultiTurnText"]>[0]) {
      const config = getAgentConfig();
      const client = getOpenAIClient(config);

      const stream = await client.responses.create({
        model: effectiveModel,
        stream: true,
        ...(!hosted && { instructions: systemInstruction }),
        input: buildInput(history, userText),
        ...(!hosted && { tools: getInlineTools() }),
      });

      let text = "";
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") text += event.delta ?? "";
      }

      if (!text.trim()) throw new Error("Empty agent response");
      return text.trim();
    },

    async *generateMultiTurnTextStream({
      systemInstruction,
      history,
      userText,
    }: Parameters<ProviderAdapter["generateMultiTurnTextStream"]>[0]) {
      const config = getAgentConfig();
      const client = getOpenAIClient(config);

      const stream = await client.responses.create({
        model: effectiveModel,
        stream: true,
        ...(!hosted && { instructions: systemInstruction }),
        input: buildInput(history, userText),
        ...(!hosted && { tools: getInlineTools() }),
      });

      for await (const event of stream) {
        if (event.type === "response.output_text.delta" && event.delta) {
          yield event.delta;
        }
      }
    },
  };
}
