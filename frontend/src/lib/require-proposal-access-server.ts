import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-service";

/**
 * PI (owner), admin, or assigned reviewer for the same institution may access proposal documents.
 */
export async function requireProposalDocumentAccess(proposalId: string): Promise<
  | { ok: true; appUser: { id: string; institution_id: string; role: string } }
  | { ok: false; status: 401 | 403 | 404 | 503; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user: authUser },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !authUser) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  let svc: ReturnType<typeof createServiceClient>;
  try {
    svc = createServiceClient();
  } catch {
    return { ok: false, status: 503, message: "Server misconfigured" };
  }

  const { data: appUser, error: appUserErr } = await svc
    .from("users")
    .select("id, institution_id, role")
    .eq("supabase_uid", authUser.id)
    .single();

  if (appUserErr || !appUser) {
    return { ok: false, status: 403, message: "User not found" };
  }

  const role = appUser.role as string;

  const { data: proposal, error: pErr } = await svc
    .from("proposals")
    .select("id, pi_user_id, institution_id, status")
    .eq("id", proposalId)
    .eq("institution_id", appUser.institution_id)
    .single();

  if (pErr || !proposal) {
    return { ok: false, status: 404, message: "Proposal not found" };
  }

  if (role === "admin") {
    if (proposal.status === "draft") {
      return { ok: false, status: 404, message: "Proposal not found" };
    }
    return { ok: true, appUser: { id: appUser.id, institution_id: appUser.institution_id, role } };
  }
  if (role === "pi" && proposal.pi_user_id === appUser.id) {
    return { ok: true, appUser: { id: appUser.id, institution_id: appUser.institution_id, role } };
  }
  if (role === "reviewer") {
    const { data: ra } = await svc
      .from("review_assignments")
      .select("id")
      .eq("proposal_id", proposalId)
      .eq("reviewer_user_id", appUser.id)
      .maybeSingle();
    if (ra) {
      return { ok: true, appUser: { id: appUser.id, institution_id: appUser.institution_id, role } };
    }
  }

  return { ok: false, status: 403, message: "Forbidden" };
}
