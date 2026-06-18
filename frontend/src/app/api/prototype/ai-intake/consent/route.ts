import { NextResponse } from "next/server";
import { generateWithForcedToolCall, type ToolDefinition } from "@/lib/server/ai";
import type { ProtocolDraft } from "@/lib/ai-proposal-types";
import { formatSupplementaryContextForModel, type SupplementaryContextPayload } from "@/lib/ai-context";
import { loadInstitutionGuidanceForModel } from "@/lib/institution-guidance-server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const consentTool: ToolDefinition = {
  name: "consent_output",
  description: "Informed consent document and QA checklist",
  parameters: {
    type: "object",
    properties: {
      consent_markdown: {
        type: "string",
        description:
          "Full consent form in Markdown, ~8th grade reading level, short sentences, clear headers.",
      },
      missing_elements: {
        type: "array",
        items: { type: "string" },
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
    const supabase = await createServerSupabaseClient();
    const institutionGuidance = await loadInstitutionGuidanceForModel(supabase);
    const userContent = `Draft an informed consent document derived from this protocol and any supplementary materials below. Use Markdown with clear sections.\n\nProtocol:\n${JSON.stringify(protocol, null, 2)}${extra}\n\nRequirements:\n- Reading level ~8th grade; short sentences; plain language labels.\n- Include: purpose, procedures, risks, benefits, confidentiality, voluntary participation, right to withdraw, whom to contact for questions and for research-related injury, and (if applicable) a HIPAA authorization summary or note if PHI is involved.\n- List in missing_elements anything required by common IRB practice that cannot be supported from the protocol text and supplementary materials.\n`;

    const toolInput = await generateWithForcedToolCall<{
      consent_markdown: string;
      missing_elements: string[];
    }>("consent-generation", {
      systemInstruction:
        `You produce structured consent drafts and QA lists via the consent_output tool only.${institutionGuidance}`,
      history: [],
      userText: userContent,
      tool: consentTool,
    });

    return NextResponse.json({
      consent_markdown: toolInput.consent_markdown,
      missing_elements: toolInput.missing_elements ?? [],
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
