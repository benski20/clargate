import {
  FunctionCallingMode,
  GoogleGenerativeAI,
  SchemaType,
  type Content,
  type FunctionDeclaration,
  type FunctionDeclarationSchema,
} from "@google/generative-ai";
import type { JsonSchemaProperty, ProviderAdapter, ToolDefinition } from "../types";

const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview";

function getClient(): GoogleGenerativeAI {
  const key =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

const SCHEMA_TYPE_MAP: Record<string, SchemaType> = {
  string: SchemaType.STRING,
  number: SchemaType.NUMBER,
  boolean: SchemaType.BOOLEAN,
  array: SchemaType.ARRAY,
  object: SchemaType.OBJECT,
};

function toGeminiSchema(property: JsonSchemaProperty): FunctionDeclarationSchema {
  const result: Record<string, unknown> = {
    type: SCHEMA_TYPE_MAP[property.type] ?? SchemaType.STRING,
  };
  if (property.description) result.description = property.description;
  if (property.format) result.format = property.format;
  if (property.enum) result.enum = property.enum;
  if (property.items) result.items = toGeminiSchema(property.items);
  if (property.properties) {
    result.properties = Object.fromEntries(
      Object.entries(property.properties).map(([key, value]) => [key, toGeminiSchema(value)]),
    );
  }
  if (property.required) result.required = property.required;
  return result as unknown as FunctionDeclarationSchema;
}

function toGeminiFunctionDeclaration(tool: ToolDefinition): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: toGeminiSchema(tool.parameters),
  } as FunctionDeclaration;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function mergeLeadingAssistantsIntoSystem(
  systemInstruction: string,
  prior: ChatMessage[],
): { systemInstruction: string; prior: ChatMessage[] } {
  let sys = systemInstruction;
  let rest = prior;
  while (rest.length > 0 && rest[0].role === "assistant") {
    sys += `\n\n[Your prior message to the researcher — keep continuity]\n${rest[0].content}`;
    rest = rest.slice(1);
  }
  return { systemInstruction: sys, prior: rest };
}

function toContents(messages: ChatMessage[], userText: string): Content[] {
  const contents: Content[] = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userText }] });
  return contents;
}

export function createGeminiAdapter(modelOverride?: string): ProviderAdapter {
  const modelId = modelOverride || GEMINI_MODEL;

  return {
    async generateWithForcedToolCall<T extends object>({
      systemInstruction,
      history,
      userText,
      tool,
      maxOutputTokens = 8192,
    }: Parameters<ProviderAdapter["generateWithForcedToolCall"]>[0]) {
      const genAI = getClient();
      const { systemInstruction: sys, prior } = mergeLeadingAssistantsIntoSystem(
        systemInstruction,
        history,
      );
      const declaration = toGeminiFunctionDeclaration(tool);
      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: sys,
        tools: [{ functionDeclarations: [declaration] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingMode.ANY,
            allowedFunctionNames: [tool.name],
          },
        },
      });

      const result = await model.generateContent({
        contents: toContents(prior, userText),
        generationConfig: { maxOutputTokens },
      });

      const calls = result.response.functionCalls();
      const call = calls?.find((c) => c.name === tool.name) ?? calls?.[0];
      if (!call || call.name !== tool.name) {
        throw new Error("model_did_not_return_tool");
      }
      return call.args as T;
    },

    async generatePlainText({
      systemInstruction,
      userText,
      temperature = 0.4,
      maxOutputTokens = 8192,
    }: Parameters<ProviderAdapter["generatePlainText"]>[0]) {
      const genAI = getClient();
      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction,
      });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { temperature, maxOutputTokens },
      });
      const text = result.response.text();
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
      const genAI = getClient();
      const { systemInstruction: sys, prior } = mergeLeadingAssistantsIntoSystem(
        systemInstruction,
        history,
      );
      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: sys,
      });
      const result = await model.generateContent({
        contents: toContents(prior, userText),
        generationConfig: { temperature, maxOutputTokens },
      });
      const text = result.response.text();
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
      const genAI = getClient();
      const { systemInstruction: sys, prior } = mergeLeadingAssistantsIntoSystem(
        systemInstruction,
        history,
      );
      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: sys,
      });
      const result = await model.generateContentStream({
        contents: toContents(prior, userText),
        generationConfig: { temperature, maxOutputTokens },
      });
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
    },
  };
}
