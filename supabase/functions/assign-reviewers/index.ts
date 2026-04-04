import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getCallerUser, getServiceClient } from "../_shared/supabase.ts";
import { sendReviewerAssignment } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const authHeader = req.headers.get("Authorization")!;
    const user = await getCallerUser(authHeader);

    if (user.role !== "admin" && user.role !== "reviewer") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { proposal_id, reviewer_user_ids } = await req.json();
    const svc = getServiceClient();

    const { data: proposal } = await svc
      .from("proposals")
      .select("id, title, institution_id")
      .eq("id", proposal_id)
      .eq("institution_id", user.institution_id)
      .neq("status", "draft")
      .single();

    if (!proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assignments = [];
    for (const reviewerId of reviewer_user_ids) {
      const { data: reviewer } = await svc
        .from("users")
        .select("id, email, full_name, role, institution_id")
        .eq("id", reviewerId)
        .eq("institution_id", user.institution_id)
        .eq("role", "reviewer")
        .single();

      if (!reviewer) {
        return new Response(
          JSON.stringify({ error: `Reviewer ${reviewerId} not found or not a reviewer` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: existing } = await svc
        .from("review_assignments")
        .select("id")
        .eq("proposal_id", proposal_id)
        .eq("reviewer_user_id", reviewerId)
        .maybeSingle();

      if (existing) continue;

      const { data: assignment, error } = await svc
        .from("review_assignments")
        .insert({
          proposal_id,
          reviewer_user_id: reviewerId,
          assigned_by: user.id,
        })
        .select("id, proposal_id, reviewer_user_id, status, assigned_at")
        .single();

      if (error) throw new Error(error.message);

      assignments.push({ ...assignment, reviewer_name: reviewer.full_name });

      await svc.from("audit_log").insert({
        institution_id: user.institution_id,
        user_id: user.id,
        action: "reviewer_assigned",
        entity_type: "review_assignment",
        entity_id: assignment.id,
        metadata: { reviewer_id: reviewerId },
      });

      await sendReviewerAssignment(
        reviewer.email,
        reviewer.full_name,
        proposal.title,
      );
    }

    return new Response(JSON.stringify(assignments), {
      status: 201,
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
