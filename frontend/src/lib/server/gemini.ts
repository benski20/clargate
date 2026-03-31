import {
  FunctionCallingMode,
  GoogleGenerativeAI,
  SchemaType,
  type Content,
  type FunctionDeclaration,
} from "@google/generative-ai";
import type { AiChatMessage } from "@/lib/ai-proposal-types";

/** Google AI Studio model id for Gemini 3 Flash (overridable via GEMINI_MODEL). */
export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview";

export function getGeminiClient(): GoogleGenerativeAI {
  const key =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenerativeAI(key);
}

/**
 * Gemini multi-turn `contents` must start with a user turn. Merge any leading
 * assistant messages (e.g. first intake reply) into the system instruction.
 */
export function mergeLeadingAssistantsIntoSystem(
  systemInstruction: string,
  prior: AiChatMessage[],
): { systemInstruction: string; prior: AiChatMessage[] } {
  let sys = systemInstruction;
  let rest = prior;
  while (rest.length > 0 && rest[0].role === "assistant") {
    sys += `\n\n[Your prior message to the researcher — keep continuity]\n${rest[0].content}`;
    rest = rest.slice(1);
  }
  return { systemInstruction: sys, prior: rest };
}

export async function generateWithForcedToolCall<T extends object>({
  systemInstruction,
  history,
  userText,
  declaration,
  toolName,
  maxOutputTokens = 8192,
}: {
  systemInstruction: string;
  history: AiChatMessage[];
  userText: string;
  declaration: FunctionDeclaration;
  toolName: string;
  maxOutputTokens?: number;
}): Promise<T> {
  const genAI = getGeminiClient();
  const { systemInstruction: sys, prior } = mergeLeadingAssistantsIntoSystem(
    systemInstruction,
    history,
  );

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: sys,
    tools: [{ functionDeclarations: [declaration] }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingMode.ANY,
        allowedFunctionNames: [toolName],
      },
    },
  });

  const contents: Content[] = prior.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userText }] });

  const result = await model.generateContent({
    contents,
    generationConfig: { maxOutputTokens },
  });

  const response = result.response;
  const calls = response.functionCalls();
  const call = calls?.find((c) => c.name === toolName) ?? calls?.[0];

  if (!call || call.name !== toolName) {
    throw new Error("model_did_not_return_tool");
  }

  return call.args as T;
}

/** Plain text generation (no tool calling) — e.g. revision letters. */
export async function generatePlainText({
  systemInstruction,
  userText,
  temperature = 0.4,
  maxOutputTokens = 8192,
}: {
  systemInstruction: string;
  userText: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
  });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { temperature, maxOutputTokens },
  });
  const text = result.response.text();
  if (!text?.trim()) throw new Error("Empty model response");
  return text.trim();
}
