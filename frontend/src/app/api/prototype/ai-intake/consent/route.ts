import { NextResponse } from "next/server";
import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { generateWithForcedToolCall } from "@/lib/server/gemini";
import type { ProtocolDraft } from "@/lib/ai-proposal-types";
import { formatSupplementaryContextForModel, type SupplementaryContextPayload } from "@/lib/ai-context";

const consentDeclaration: FunctionDeclaration = {
  name: "consent_output",
  description: "Informed consent document and QA checklist",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      consent_markdown: {
        type: SchemaType.STRING,
        description:
          "Full consent form in Markdown, ~8th grade reading level, short sentences, clear headers.",
      },
      missing_elements: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description:
          "Required elements absent or weak (e.g. right to withdraw, voluntary participation, risks, benefits, confidentiality/HIPAA if PHI, researcher contact, IRB contact).",
      },
    },
    required: ["consent_markdown", "missing_elements"],
  },
};

export async function POST(req: Request) {
  try {
    const { protocol, supplementary_context } = (await req.json()) as {
      protocol: ProtocolDraft;
      supplementary_context?: SupplementaryContextPayload;
    };
    if (!protocol || typeof protocol !== "object") {
      return NextResponse.json({ error: "protocol required" }, { status: 400 });
    }

    const extra = formatSupplementaryContextForModel(
      supplementary_context ?? { notes: "", attachments: [] },
    );
    const userContent = `Draft an informed consent document derived from this protocol and any supplementary materials below. Use Markdown with clear sections.\n\nProtocol:\n${JSON.stringify(protocol, null, 2)}${extra}\n\nRequirements:\n- Reading level ~8th grade; short sentences; plain language labels.\n- Include: purpose, procedures, risks, benefits, confidentiality, voluntary participation, right to withdraw, whom to contact for questions and for research-related injury, and (if applicable) a HIPAA authorization summary or note if PHI is involved.\n- List in missing_elements anything required by common IRB practice that cannot be supported from the protocol text and supplementary materials.\n`;

    const toolInput = await generateWithForcedToolCall<{
      consent_markdown: string;
      missing_elements: string[];
    }>({
      systemInstruction:
        "You produce structured consent drafts and QA lists via the consent_output tool only.",
      history: [],
      userText: userContent,
      declaration: consentDeclaration,
      toolName: "consent_output",
    });

    return NextResponse.json({
      consent_markdown: toolInput.consent_markdown,
      missing_elements: toolInput.missing_elements ?? [],
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Gemini request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
