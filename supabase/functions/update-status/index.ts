import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getCallerUser, getServiceClient } from "../_shared/supabase.ts";

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

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const authHeader = req.headers.get("Authorization")!;
    const user = await getCallerUser(authHeader);

    if (user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { proposal_id, status } = await req.json();
    const svc = getServiceClient();

    const { data: proposal } = await svc
      .from("proposals")
      .select("id, status, institution_id")
      .eq("id", proposal_id)
      .eq("institution_id", user.institution_id)
      .single();

    if (!proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = ALLOWED_TRANSITIONS[proposal.status] || [];
    if (!allowed.includes(status)) {
      return new Response(
        JSON.stringify({
          error: `Cannot transition from ${proposal.status} to ${status}. Allowed: ${JSON.stringify(allowed)}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: updated, error } = await svc
      .from("proposals")
      .update({ status })
      .eq("id", proposal_id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await svc.from("audit_log").insert({
      institution_id: user.institution_id,
      user_id: user.id,
      action: "proposal_status_changed",
      entity_type: "proposal",
      entity_id: proposal_id,
      metadata: { new_status: status },
    });

    return new Response(JSON.stringify(updated), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    return new Response(JSON.stringify({ error: msg }), {
      status: msg === "Unauthorized" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
