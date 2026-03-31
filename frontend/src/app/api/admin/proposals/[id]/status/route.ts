import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-server";
import { createServiceClient } from "@/lib/supabase-service";
import { isProposalStatusTransitionAllowed } from "@/lib/proposal-status-transitions";
import type { ProposalStatus } from "@/lib/types";

export const runtime = "nodejs";

const STATUSES: ProposalStatus[] = [
  "draft",
  "submitted",
  "initial_review",
  "revisions_requested",
  "resubmitted",
  "under_committee_review",
  "approved",
  "rejected",
  "tabled",
];

function isProposalStatus(s: string): s is ProposalStatus {
  return STATUSES.includes(s as ProposalStatus);
}

/**
 * Updates proposal status using the Next.js session cookie (no Edge Function JWT).
 * Requires admin + service role for audit_log insert.
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
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  const next = typeof body.status === "string" ? body.status : "";

  if (!isProposalStatus(next)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data: proposal, error: fetchErr } = await svc
    .from("proposals")
    .select("id, status, institution_id, title")
    .eq("id", proposalId)
    .eq("institution_id", auth.session.appUser.institution_id)
    .single();

  if (fetchErr || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const current = proposal.status as ProposalStatus;
  if (!isProposalStatusTransitionAllowed(current, next)) {
    return NextResponse.json(
      {
        error: `Cannot transition from ${current} to ${next}`,
      },
      { status: 400 },
    );
  }

  const { data: updated, error: updateErr } = await svc
    .from("proposals")
    .update({ status: next })
    .eq("id", proposalId)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await svc.from("audit_log").insert({
    institution_id: auth.session.appUser.institution_id,
    user_id: auth.session.appUser.id,
    action: "proposal_status_changed",
    entity_type: "proposal",
    entity_id: proposalId,
    metadata: {
      proposal_title: proposal.title,
      previous_status: current,
      new_status: next,
      source: "next_api",
    },
  });

  return NextResponse.json(updated);
}
