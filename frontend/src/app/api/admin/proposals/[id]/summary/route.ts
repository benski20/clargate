import { NextRequest, NextResponse } from "next/server";
import { generateWithForcedToolCall, resolveProviderForTask, type ToolDefinition } from "@/lib/server/ai";
import { requireAdminOrAssignedReviewerForProposal } from "@/lib/require-proposal-staff-server";
import { createServiceClient } from "@/lib/supabase-service";
import { getProposalReviewTypeLabel } from "@/lib/review-types";
import { buildAdminSummaryContext } from "@/lib/admin-summary-context";

export const runtime = "nodejs";

const summaryTool: ToolDefinition = {
  name: "proposal_summary",
  description: "Structured IRB admin summary for a proposal",
  parameters: {
    type: "object",
    properties: {
      risk_level: {
        type: "string",
        format: "enum",
        enum: ["minimal", "moderate", "significant"],
      },
      participant_population: { type: "string" },
      methodology_summary: { type: "string" },
      key_concerns: { type: "array", items: { type: "string" } },
      regulatory_rationale: { type: "string" },
      study_duration_estimate: { type: "string" },
      data_sensitivity: {
        type: "string",
        format: "enum",
        enum: ["low", "medium", "high"],
      },
    },
    required: [
      "risk_level",
      "participant_population",
      "methodology_summary",
      "key_concerns",
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
  const { id: proposalId } = await context.params;

  const auth = await requireAdminOrAssignedReviewerForProposal(proposalId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

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
    .select("id, title, form_data, institution_id, review_type")
    .eq("id", proposalId)
    .eq("institution_id", auth.session.appUser.institution_id)
    .neq("status", "draft")
    .single();

  if (fetchErr || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const { data: documents } = await svc
    .from("proposal_documents")
    .select("file_name")
    .eq("proposal_id", proposal.id)
    .order("uploaded_at", { ascending: false });

  const documentFileNames = (documents ?? [])
    .map((d) => (typeof d.file_name === "string" ? d.file_name : ""))
    .filter(Boolean);

  try {
    const formData =
      proposal.form_data && typeof proposal.form_data === "object" && !Array.isArray(proposal.form_data)
        ? (proposal.form_data as Record<string, unknown>)
        : null;

    const contextJson = buildAdminSummaryContext(proposal.title, formData, {
      documentFileNames,
      reviewType: proposal.review_type,
    });
    const userText = `Produce an IRB administrator summary for this submission.\n\n${contextJson}`;

    const summary = await generateWithForcedToolCall<Record<string, unknown>>("admin-summary", {
      systemInstruction: `You are an expert IRB (Institutional Review Board) analyst. Given a research proposal's structured form data, AI review notes, compliance flags, and material previews, produce a structured JSON summary for IRB administrators.

When many files are present, attachment text may be truncated — prioritize ai_review.protocol_review_sections and compliance_flags over raw previews.

Write concisely — each field should be scannable in one glance:
- risk_level: minimal|moderate|significant
- participant_population: one sentence
- methodology_summary: 1–2 sentences
- key_concerns: up to 5 one-line bullets (≤120 chars each)
- regulatory_rationale: 1–2 sentences for the submitted review category (see submitted_review_category — do not invent a different category)
- study_duration_estimate: a short phrase if discernible, else "Not specified"
- data_sensitivity: low|medium|high

Be objective and note missing information where applicable.`,
      history: [],
      userText,
      tool: summaryTool,
    });

    summary.regulatory_category_suggestion = getProposalReviewTypeLabel(proposal);

    const { data: aiSummary, error: insertErr } = await svc
      .from("ai_summaries")
      .insert({
        proposal_id: proposal.id,
        summary,
        model_used: resolveProviderForTask("admin-summary"),
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
