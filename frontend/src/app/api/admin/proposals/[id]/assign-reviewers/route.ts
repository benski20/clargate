import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-server";
import { createServiceClient } from "@/lib/supabase-service";
import { sendReviewerAssignmentEmail } from "@/lib/email-ses";

export const runtime = "nodejs";

/**
 * Assign reviewers — cookie session + service role (no Supabase Edge Function / JWT).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
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

  const { id: proposalId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    reviewer_user_ids?: unknown;
  };

  const rawIds = body.reviewer_user_ids;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json({ error: "reviewer_user_ids must be a non-empty array" }, { status: 400 });
  }

  const reviewerUserIds = rawIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (reviewerUserIds.length === 0) {
    return NextResponse.json({ error: "Invalid reviewer_user_ids" }, { status: 400 });
  }

  const user = auth.session.appUser;

  const { data: proposal, error: proposalErr } = await svc
    .from("proposals")
    .select("id, title, institution_id")
    .eq("id", proposalId)
    .eq("institution_id", user.institution_id)
    .single();

  if (proposalErr || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const assignments: Array<{
    id: string;
    proposal_id: string;
    reviewer_user_id: string;
    status: string;
    assigned_at: string;
    reviewer_name: string | null;
  }> = [];

  for (const reviewerId of reviewerUserIds) {
    const { data: reviewer, error: revErr } = await svc
      .from("users")
      .select("id, email, full_name, role, institution_id")
      .eq("id", reviewerId)
      .eq("institution_id", user.institution_id)
      .eq("role", "reviewer")
      .single();

    if (revErr || !reviewer) {
      return NextResponse.json(
        { error: `Reviewer ${reviewerId} not found or not a reviewer` },
        { status: 400 },
      );
    }

    const { data: existing } = await svc
      .from("review_assignments")
      .select("id")
      .eq("proposal_id", proposalId)
      .eq("reviewer_user_id", reviewerId)
      .maybeSingle();

    if (existing) continue;

    const { data: assignment, error: insErr } = await svc
      .from("review_assignments")
      .insert({
        proposal_id: proposalId,
        reviewer_user_id: reviewerId,
        assigned_by: user.id,
      })
      .select("id, proposal_id, reviewer_user_id, status, assigned_at")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    assignments.push({
      ...assignment,
      reviewer_name: reviewer.full_name as string | null,
    });

    await svc.from("audit_log").insert({
      institution_id: user.institution_id,
      user_id: user.id,
      action: "reviewer_assigned",
      entity_type: "review_assignment",
      entity_id: assignment.id,
      metadata: { reviewer_id: reviewerId },
    });

    await sendReviewerAssignmentEmail(
      reviewer.email as string,
      (reviewer.full_name as string) || "Reviewer",
      proposal.title as string,
    );
  }

  return NextResponse.json(assignments, { status: 201 });
}
