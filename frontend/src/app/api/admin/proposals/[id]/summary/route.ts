import { NextRequest, NextResponse } from "next/server";
import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { requireAdminSession } from "@/lib/require-admin-server";
import { createServiceClient } from "@/lib/supabase-service";
import { generateWithForcedToolCall } from "@/lib/server/gemini";

export const runtime = "nodejs";

const summaryDeclaration: FunctionDeclaration = {
  name: "proposal_summary",
  description: "Structured IRB admin summary for a proposal",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      risk_level: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["minimal", "moderate", "significant"],
      },
      participant_population: { type: SchemaType.STRING },
      methodology_summary: { type: SchemaType.STRING },
      key_concerns: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      regulatory_category_suggestion: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["exempt", "expedited", "full_board"],
      },
      regulatory_rationale: { type: SchemaType.STRING },
      study_duration_estimate: { type: SchemaType.STRING },
      data_sensitivity: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["low", "medium", "high"],
      },
    },
    required: [
      "risk_level",
      "participant_population",
      "methodology_summary",
      "key_concerns",
      "regulatory_category_suggestion",
      "regulatory_rationale",
      "study_duration_estimate",
      "data_sensitivity",
    ],
  },
};

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id: proposalId } = await context.params;

  let svc: ReturnType<typeof createServiceClient>;
  try {
    svc = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    );
  }

  const { data: proposal, error: fetchErr } = await svc
    .from("proposals")
    .select("id, title, form_data, institution_id")
    .eq("id", proposalId)
    .eq("institution_id", auth.session.appUser.institution_id)
    .neq("status", "draft")
    .single();

  if (fetchErr || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  try {
    const userText = `Title: ${proposal.title}\n\nForm Data:\n${JSON.stringify(proposal.form_data, null, 2)}`;

    const summary = await generateWithForcedToolCall<Record<string, unknown>>({
      systemInstruction: `You are an expert IRB (Institutional Review Board) analyst. Given a research proposal's form data, produce a structured JSON summary for IRB administrators.

Return fields:
- risk_level: minimal|moderate|significant
- participant_population: concise description; mention vulnerable groups if present
- methodology_summary: 2-3 sentences
- key_concerns: concrete admin concerns
- regulatory_category_suggestion: exempt|expedited|full_board
- regulatory_rationale: brief rationale
- study_duration_estimate: estimate if discernible
- data_sensitivity: low|medium|high

Be objective and note missing information where applicable.`,
      history: [],
      userText,
      declaration: summaryDeclaration,
      toolName: "proposal_summary",
    });

    const { data: aiSummary, error: insertErr } = await svc
      .from("ai_summaries")
      .insert({
        proposal_id: proposal.id,
        summary,
        model_used: process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview",
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    await svc.from("audit_log").insert({
      institution_id: auth.session.appUser.institution_id,
      user_id: auth.session.appUser.id,
      action: "ai_summary_generated",
      entity_type: "ai_summary",
      entity_id: aiSummary.id,
    });

    return NextResponse.json({ id: aiSummary.id, summary });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Summary generation failed" },
      { status: 500 },
    );
  }
}
