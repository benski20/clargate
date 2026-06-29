export type JsonSchemaProperty = {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  format?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: JsonSchemaProperty;
};

export type AiTask =
  | "category-prediction"
  | "compliance-flags"
  | "board-reviewer"
  | "board-synthesis"
  | "admin-summary"
  | "intake-chat"
  | "intake-chat-stream"
  | "consent-generation"
  | "protocol-synthesis"
  | "revision-suggestions"
  | "revision-letter"
  | "file-extraction"
  | "upload-assistant"
  | "upload-assistant-stream"
  | "questionnaire-analyze"
  | "questionnaire-chat"
  | "questionnaire-chat-stream";

export type ProviderName = "gemini" | "azure-openai" | "azure-arbiter" | "azure-foundry" | "azure-submission" | "azure-board" | "openai";

export type ModelAssignment = {
  provider: ProviderName;
  model: string;
};

export type ProviderAdapter = {
  generateWithForcedToolCall<T extends object>(params: {
    systemInstruction: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    userText: string;
    tool: ToolDefinition;
    maxOutputTokens?: number;
  }): Promise<T>;

  generatePlainText(params: {
    systemInstruction: string;
    userText: string;
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<string>;

  generateMultiTurnText(params: {
    systemInstruction: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    userText: string;
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<string>;

  generateMultiTurnTextStream(params: {
    systemInstruction: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    userText: string;
    temperature?: number;
    maxOutputTokens?: number;
  }): AsyncGenerator<string, void, void>;
};
