import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/** Admin or reviewer assigned to this proposal (non-draft, same institution). */
export type ProposalStaffSession = {
  supabase: SupabaseClient;
  appUser: { id: string; institution_id: string; role: string };
};

/**
 * For AI summary and other staff tooling: admins (institution queue) or reviewers assigned to the proposal.
 */
export async function requireAdminOrAssignedReviewerForProposal(
  proposalId: string,
): Promise<
  { ok: true; session: ProposalStaffSession } | { ok: false; status: 401 | 403 | 404; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const { data: appUser, error } = await supabase
    .from("users")
    .select("id, institution_id, role")
    .eq("supabase_uid", user.id)
    .single();

  if (error || !appUser) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  const role = appUser.role as string;
  if (role !== "admin" && role !== "reviewer") {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  const { data: proposal, error: pErr } = await supabase
    .from("proposals")
    .select("id, institution_id, status")
    .eq("id", proposalId)
    .eq("institution_id", appUser.institution_id)
    .single();

  if (pErr || !proposal) {
    return { ok: false, status: 404, message: "Proposal not found" };
  }

  if (proposal.status === "draft") {
    return { ok: false, status: 404, message: "Proposal not found" };
  }

  if (role === "admin") {
    return {
      ok: true,
      session: {
        supabase,
        appUser: {
          id: appUser.id as string,
          institution_id: appUser.institution_id as string,
          role,
        },
      },
    };
  }

  const { data: assignment } = await supabase
    .from("review_assignments")
    .select("id")
    .eq("proposal_id", proposalId)
    .eq("reviewer_user_id", appUser.id)
    .maybeSingle();

  if (!assignment) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return {
    ok: true,
    session: {
      supabase,
      appUser: {
        id: appUser.id as string,
        institution_id: appUser.institution_id as string,
        role,
      },
    },
  };
}
