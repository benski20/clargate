import { NextResponse } from "next/server";
import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { generateWithForcedToolCall } from "@/lib/server/gemini";
import type { ComplianceFlag, ProtocolDraft } from "@/lib/ai-proposal-types";
import { PROTOCOL_SECTION_KEYS, normalizeComplianceFlags } from "@/lib/ai-proposal-types";
import { formatSupplementaryContextForModel, type SupplementaryContextPayload } from "@/lib/ai-context";
import { loadInstitutionGuidanceForModel } from "@/lib/institution-guidance-server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { determineReviewCategory } from "@/lib/server/determine-review-category";

const sectionEnum: string[] = [...PROTOCOL_SECTION_KEYS, "consent", "general"];
const severityEnum = ["info", "warning", "error"] as const;

const complianceFlagsDeclaration: FunctionDeclaration = {
  name: "compliance_flags",
  description: "Pre-submission IRB compliance flag review",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
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
    required: ["flags"],
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

    const flagsPrompt = `You are an IRB compliance analyst. Review the following protocol, consent form, and supplementary materials for issues BEFORE submission.

Reference framework: 45 CFR Part 46 (identify plausible gaps, cite part/subpart when helpful; you are not rendering a legal opinion).

Protocol:\n${JSON.stringify(protocol, null, 2)}\n\nConsent:\n${consent_markdown || "(missing)"}${extra}\n\nReturn actionable flags only (each with id, severity info|warning|error, message, section_key one of: ${sectionEnum.join(", ")}, optional cfr_reference, optional actionable fix hint).
Flag: missing sections, internal contradictions between protocol, consent, and uploads/notes, factors suggesting higher review level. Do NOT use markdown bold (**text**) or italic formatting in your output.`;

    const [flagsResult, categoryResult] = await Promise.all([
      generateWithForcedToolCall<{ flags: ComplianceFlag[] }>({
        systemInstruction: `You return compliance flags only via the compliance_flags tool.${institutionGuidance}`,
        history: [],
        userText: flagsPrompt,
        declaration: complianceFlagsDeclaration,
        toolName: "compliance_flags",
      }),
      determineReviewCategory(
        protocol,
        consent_markdown || "",
        extra,
      ),
    ]);

    return NextResponse.json({
      predicted_category: categoryResult.predicted_category,
      category_confidence: categoryResult.confidence,
      category_reasoning: categoryResult.reasoning,
      flags: normalizeComplianceFlags(flagsResult.flags),
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Gemini request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
