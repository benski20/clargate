import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrAssignedReviewerForProposal } from "@/lib/require-proposal-staff-server";
import { createServiceClient } from "@/lib/supabase-service";
import { loadInstitutionGuidanceForModel } from "@/lib/institution-guidance-server";
import { simulateBoardReview } from "@/lib/server/simulate-board-review";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: proposalId } = await context.params;

  const auth = await requireAdminOrAssignedReviewerForProposal(proposalId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  if (auth.session.appUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    .select("id, title, form_data, institution_id")
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

  const institutionGuidance = await loadInstitutionGuidanceForModel(auth.session.supabase);

  try {
    const formData =
      proposal.form_data && typeof proposal.form_data === "object" && !Array.isArray(proposal.form_data)
        ? (proposal.form_data as Record<string, unknown>)
        : null;

    const result = await simulateBoardReview({
      title: proposal.title,
      formData,
      documentFileNames,
      institutionGuidance,
    });

    const { error: insertErr } = await svc.from("ai_summaries").insert({
      proposal_id: proposal.id,
      summary: { type: "simulated_board_review", ...result },
      model_used: result.model_used,
    });

    if (insertErr) {
      console.error("Failed to store board simulation:", insertErr.message);
    }

    await svc.from("audit_log").insert({
      institution_id: auth.session.appUser.institution_id,
      user_id: auth.session.appUser.id,
      action: "simulated_board_review_generated",
      entity_type: "proposal",
      entity_id: proposal.id,
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Board simulation failed" },
      { status: 500 },
    );
  }
}
