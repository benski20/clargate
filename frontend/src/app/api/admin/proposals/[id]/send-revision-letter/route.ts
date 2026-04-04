import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-server";
import { createServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["initial_review"],
  initial_review: [
    "revisions_requested",
    "under_committee_review",
    "approved",
    "rejected",
  ],
  revisions_requested: ["resubmitted"],
  resubmitted: ["initial_review"],
  under_committee_review: [
    "approved",
    "rejected",
    "tabled",
    "revisions_requested",
  ],
  tabled: ["under_committee_review"],
  approved: [],
  rejected: [],
};

/**
 * Send revision letter to PI — cookie session + service role (no Supabase Edge JWT).
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
    content?: string;
    letter_id?: string | null;
    transition_to_revisions_requested?: boolean;
  };

  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) {
    return NextResponse.json({ error: "Non-empty content is required" }, { status: 400 });
  }

  const transitionToRevisionsRequested = body.transition_to_revisions_requested !== false;
  const letterId =
    typeof body.letter_id === "string" && body.letter_id.trim() ? body.letter_id.trim() : null;

  const user = auth.session.appUser;
  const trimmed = content.trim();

  const { data: proposal, error: pErr } = await svc
    .from("proposals")
    .select("id, title, status, pi_user_id, institution_id")
    .eq("id", proposalId)
    .eq("institution_id", user.institution_id)
    .neq("status", "draft")
    .single();

  if (pErr || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const sentAt = new Date().toISOString();
  let letterRow: Record<string, unknown>;

  if (letterId) {
    const { data: existing } = await svc
      .from("letters")
      .select("id, proposal_id")
      .eq("id", letterId)
      .eq("proposal_id", proposalId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Letter not found for this proposal" }, { status: 404 });
    }

    const { data: updated, error: upErr } = await svc
      .from("letters")
      .update({
        content: trimmed,
        sent_at: sentAt,
        edited_by: user.id,
      })
      .eq("id", letterId)
      .select()
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    letterRow = updated as Record<string, unknown>;
  } else {
    const { data: inserted, error: insErr } = await svc
      .from("letters")
      .insert({
        proposal_id: proposal.id,
        type: "revision",
        content: trimmed,
        generated_by_ai: false,
        edited_by: user.id,
        sent_at: sentAt,
      })
      .select()
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    letterRow = inserted as Record<string, unknown>;
  }

  let newStatus: string | null = null;
  if (transitionToRevisionsRequested) {
    const allowed = ALLOWED_TRANSITIONS[proposal.status as string] || [];
    if (allowed.includes("revisions_requested")) {
      const { error: stErr } = await svc
        .from("proposals")
        .update({ status: "revisions_requested" })
        .eq("id", proposalId);
      if (stErr) {
        return NextResponse.json({ error: stErr.message }, { status: 500 });
      }
      newStatus = "revisions_requested";

      await svc.from("audit_log").insert({
        institution_id: user.institution_id,
        user_id: user.id,
        action: "proposal_status_changed",
        entity_type: "proposal",
        entity_id: proposalId,
        metadata: {
          proposal_title: proposal.title,
          previous_status: proposal.status,
          new_status: "revisions_requested",
          via: "send_revision_letter",
        },
      });
    }
  }

  await svc.from("audit_log").insert({
    institution_id: user.institution_id,
    user_id: user.id,
    action: "revision_letter_sent",
    entity_type: "letter",
    entity_id: letterRow.id as string,
    metadata: { proposal_id: proposalId },
  });

  return NextResponse.json({
    letter: letterRow,
    status: newStatus ?? proposal.status,
  });
}
