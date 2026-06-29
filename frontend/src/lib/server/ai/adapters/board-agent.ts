import { AIProjectClient } from "@azure/ai-projects";
import { ClientSecretCredential } from "@azure/identity";
import type OpenAI from "openai";
import type { ProviderAdapter, ToolDefinition, JsonSchemaProperty } from "../types";

type ChatMessage = { role: "user" | "assistant"; content: string };

export type BoardAgentConfig = {
  endpoint: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  agentName: string;
};

let cachedClient: OpenAI | null = null;
let cachedConfigKey = "";

function getOpenAIClient(config: BoardAgentConfig): OpenAI {
  const key = `board:${config.tenantId}:${config.clientId}:${config.endpoint}`;
  if (cachedClient && cachedConfigKey === key) return cachedClient;

  const credential = new ClientSecretCredential(
    config.tenantId,
    config.clientId,
    config.clientSecret,
  );
  const project = new AIProjectClient(config.endpoint, credential);
  cachedClient = project.getOpenAIClient({
    azureConfig: { allowPreview: true, agentName: config.agentName },
    timeout: 5 * 60 * 1000,
  });
  cachedConfigKey = key;
  return cachedClient;
}

function toFunctionToolSchema(
  property: JsonSchemaProperty,
): Record<string, unknown> {
  const result: Record<string, unknown> = { type: property.type };
  if (property.description) result.description = property.description;
  if (property.enum) result.enum = property.enum;
  if (property.items) result.items = toFunctionToolSchema(property.items);
  if (property.properties) {
    result.properties = Object.fromEntries(
      Object.entries(property.properties).map(([propertyKey, value]) => [
        propertyKey,
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

export function getBoardAgentConfig(): BoardAgentConfig {
  const endpoint =
    process.env.AZURE_BOARD_AGENT_ENDPOINT?.trim() ??
    process.env.AZURE_ARBITER_ENDPOINT?.trim();
  const tenantId = process.env.AZURE_ARBITER_TENANT_ID?.trim();
  const clientId = process.env.AZURE_ARBITER_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_ARBITER_CLIENT_SECRET?.trim();
  const agentName = process.env.AZURE_BOARD_AGENT_NAME?.trim();

  if (!endpoint || !tenantId || !clientId || !clientSecret || !agentName) {
    throw new Error(
      "AZURE_BOARD_AGENT_NAME, AZURE_BOARD_AGENT_ENDPOINT (or AZURE_ARBITER_ENDPOINT), " +
        "AZURE_ARBITER_TENANT_ID, AZURE_ARBITER_CLIENT_ID, and AZURE_ARBITER_CLIENT_SECRET must be set",
    );
  }
  return { endpoint, tenantId, clientId, clientSecret, agentName };
}

export function isBoardAgentConfigured(): boolean {
  return Boolean(
    process.env.AZURE_BOARD_AGENT_NAME?.trim() &&
      (process.env.AZURE_BOARD_AGENT_ENDPOINT?.trim() ||
        process.env.AZURE_ARBITER_ENDPOINT?.trim()) &&
      process.env.AZURE_ARBITER_TENANT_ID?.trim() &&
      process.env.AZURE_ARBITER_CLIENT_ID?.trim() &&
      process.env.AZURE_ARBITER_CLIENT_SECRET?.trim(),
  );
}

export function createBoardAgentAdapter(model: string): ProviderAdapter {
  const agentModel =
    process.env.AZURE_BOARD_AGENT_MODEL?.trim() || model;

  return {
    async generateWithForcedToolCall<T extends object>({
      systemInstruction,
      history,
      userText,
      tool,
    }: Parameters<ProviderAdapter["generateWithForcedToolCall"]>[0]) {
      const config = getBoardAgentConfig();
      const client = getOpenAIClient(config);

      const jsonPrompt =
        `\n\nYou MUST respond with a single JSON object matching this schema ` +
        `(no markdown, no code fences, no extra text):\n` +
        JSON.stringify(toFunctionToolSchema(tool.parameters), null, 2);

      const contextPrompt = systemInstruction
        ? `${systemInstruction}\n\n${userText}${jsonPrompt}`
        : `${userText}${jsonPrompt}`;

      let fullText = "";
      try {
        const stream = await client.responses.create({
          model: agentModel,
          stream: true,
          input: buildInput(history, contextPrompt),
        });

        for await (const event of stream) {
          if (event.type === "response.output_text.delta")
            fullText += event.delta ?? "";
        }
      } catch (streamError: unknown) {
        const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
        if (errorMessage.includes("tool_user_error") || errorMessage.includes("Authentication failed")) {
          console.warn("[board-agent] Knowledge base auth failed, retrying without agent KB:", errorMessage);
          const fallbackStream = await client.responses.create({
            model: agentModel,
            stream: true,
            instructions: systemInstruction,
            input: buildInput(history, userText + jsonPrompt),
          });

          for await (const event of fallbackStream) {
            if (event.type === "response.output_text.delta")
              fullText += event.delta ?? "";
          }
        } else {
          throw streamError;
        }
      }

      const cleaned = fullText
        .replace(/```(?:json)?\s*/g, "")
        .replace(/```\s*/g, "");
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as T;
      throw new Error("Board agent did not return valid JSON");
    },

    async generatePlainText({
      systemInstruction,
      userText,
    }: Parameters<ProviderAdapter["generatePlainText"]>[0]) {
      const config = getBoardAgentConfig();
      const client = getOpenAIClient(config);

      const contextPrompt = systemInstruction
        ? `${systemInstruction}\n\n${userText}`
        : userText;

      const stream = await client.responses.create({
        model: agentModel,
        stream: true,
        input: contextPrompt,
      });

      let text = "";
      for await (const event of stream) {
        if (event.type === "response.output_text.delta")
          text += event.delta ?? "";
      }

      if (!text.trim()) throw new Error("Empty board agent response");
      return text.trim();
    },

    async generateMultiTurnText({
      systemInstruction,
      history,
      userText,
    }: Parameters<ProviderAdapter["generateMultiTurnText"]>[0]) {
      const config = getBoardAgentConfig();
      const client = getOpenAIClient(config);

      const contextPrompt = systemInstruction
        ? `${systemInstruction}\n\n${userText}`
        : userText;

      const stream = await client.responses.create({
        model: agentModel,
        stream: true,
        input: buildInput(history, contextPrompt),
      });

      let text = "";
      for await (const event of stream) {
        if (event.type === "response.output_text.delta")
          text += event.delta ?? "";
      }

      if (!text.trim()) throw new Error("Empty board agent response");
      return text.trim();
    },

    async *generateMultiTurnTextStream({
      systemInstruction,
      history,
      userText,
    }: Parameters<ProviderAdapter["generateMultiTurnTextStream"]>[0]) {
      const config = getBoardAgentConfig();
      const client = getOpenAIClient(config);

      const contextPrompt = systemInstruction
        ? `${systemInstruction}\n\n${userText}`
        : userText;

      const stream = await client.responses.create({
        model: agentModel,
        stream: true,
        input: buildInput(history, contextPrompt),
      });

      for await (const event of stream) {
        if (event.type === "response.output_text.delta" && event.delta) {
          yield event.delta;
        }
      }
    },
  };
}
