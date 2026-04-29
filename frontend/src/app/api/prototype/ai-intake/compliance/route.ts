import { NextResponse } from "next/server";
import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { generateWithForcedToolCall } from "@/lib/server/gemini";
import type { ComplianceFlag, ProtocolDraft } from "@/lib/ai-proposal-types";
import { PROTOCOL_SECTION_KEYS, normalizeComplianceFlags } from "@/lib/ai-proposal-types";
import { formatSupplementaryContextForModel, type SupplementaryContextPayload } from "@/lib/ai-context";
import { loadInstitutionGuidanceForModel } from "@/lib/institution-guidance-server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const sectionEnum: string[] = [...PROTOCOL_SECTION_KEYS, "consent", "general"];
const severityEnum = ["info", "warning", "error"] as const;

const complianceDeclaration: FunctionDeclaration = {
  name: "compliance_review",
  description: "Pre-submission IRB compliance review",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      predicted_category: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["exempt", "expedited", "full_board"],
        description: "Best-effort prediction; not legal determination.",
      },
      flags: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING },
            severity: {
              type: SchemaType.STRING,
              format: "enum",
              enum: [...severityEnum],
            },
            message: { type: SchemaType.STRING },
            section_key: {
              type: SchemaType.STRING,
              format: "enum",
              enum: sectionEnum,
            },
            cfr_reference: { type: SchemaType.STRING },
            actionable: { type: SchemaType.STRING },
          },
          required: ["id", "severity", "message", "section_key"],
        },
      },
    },
    required: ["predicted_category", "flags"],
  },
};

export async function POST(req: Request) {
  try {
    const { protocol, consent_markdown, supplementary_context } = (await req.json()) as {
      protocol: ProtocolDraft;
      consent_markdown: string;
      supplementary_context?: SupplementaryContextPayload;
    };
    if (!protocol) {
      return NextResponse.json({ error: "protocol required" }, { status: 400 });
    }

    const extra = formatSupplementaryContextForModel(
      supplementary_context ?? { notes: "", attachments: [] },
    );
    const supabase = await createServerSupabaseClient();
    const institutionGuidance = await loadInstitutionGuidanceForModel(supabase);
    const userContent = `You are an IRB compliance analyst. Review the following protocol, consent form, and supplementary materials for issues BEFORE submission.

Reference framework: 45 CFR Part 46 at a high level (identify plausible gaps, cite part/subpart when helpful; you are not rendering a legal opinion).

Protocol:\n${JSON.stringify(protocol, null, 2)}\n\nConsent:\n${consent_markdown || "(missing)"}${extra}\n\nReturn actionable flags only (each with id, severity info|warning|error, message, section_key one of: ${sectionEnum.join(", ")}, optional cfr_reference, optional actionable fix hint).\nAlso predict review category: exempt vs expedited vs full_board (heuristic only).\nFlag: missing sections, internal contradictions between protocol, consent, and uploads/notes, factors suggesting full board (e.g. greater than minimal risk, vulnerable populations, deception).\n`;

    const toolInput = await generateWithForcedToolCall<{
      predicted_category: string;
      flags: ComplianceFlag[];
    }>({
      systemInstruction:
        `You return compliance reviews only via the compliance_review tool.${institutionGuidance}`,
      history: [],
      userText: userContent,
      declaration: complianceDeclaration,
      toolName: "compliance_review",
    });

    const { predicted_category, flags } = toolInput;
    const cat =
      predicted_category === "exempt" ||
      predicted_category === "expedited" ||
      predicted_category === "full_board"
        ? predicted_category
        : "full_board";

    return NextResponse.json({
      predicted_category: cat,
      flags: normalizeComplianceFlags(flags),
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Gemini request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
