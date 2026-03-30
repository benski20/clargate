import { NextResponse } from "next/server";
import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { generateWithForcedToolCall } from "@/lib/server/gemini";
import type { ComplianceFlag, ProtocolDraft } from "@/lib/ai-proposal-types";

const suggestionsDeclaration: FunctionDeclaration = {
  name: "revision_suggestions",
  description: "Concrete revision suggestions for the PI before IRB submission",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      suggestions: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: "Short, actionable bullets (max 12)",
      },
    },
    required: ["suggestions"],
  },
};

export async function POST(req: Request) {
  try {
    const { protocol, compliance_flags } = (await req.json()) as {
      protocol?: ProtocolDraft;
      compliance_flags?: ComplianceFlag[];
    };
    if (!protocol) {
      return NextResponse.json({ error: "protocol required" }, { status: 400 });
    }

    const flags = Array.isArray(compliance_flags) ? compliance_flags : [];
    const userText = `Given this structured protocol JSON and compliance flags, list concise revision suggestions for the research team (not repeating the flags verbatim; focus on next steps and clarifications).

Protocol:
${JSON.stringify(protocol, null, 2)}

Compliance flags:
${JSON.stringify(flags, null, 2)}`;

    const result = await generateWithForcedToolCall<{ suggestions: string[] }>({
      systemInstruction:
        "You return revision suggestions only via the revision_suggestions tool. Keep bullets short and actionable.",
      history: [],
      userText,
      declaration: suggestionsDeclaration,
      toolName: "revision_suggestions",
      maxOutputTokens: 2048,
    });

    const suggestions = Array.isArray(result.suggestions)
      ? result.suggestions.filter((s) => typeof s === "string" && s.trim()).slice(0, 12)
      : [];

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Suggestions failed", suggestions: [] },
      { status: 500 },
    );
  }
}
