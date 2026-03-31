import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { sendRevisionLetterToPi } from "../_shared/email.ts";
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

    const {
      proposal_id,
      content,
      letter_id,
      transition_to_revisions_requested = true,
      email_pi = true,
    } = await req.json();

    if (!proposal_id || typeof content !== "string" || !content.trim()) {
      return new Response(JSON.stringify({ error: "proposal_id and non-empty content are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = getServiceClient();
    const trimmed = content.trim();

    const { data: proposal } = await svc
      .from("proposals")
      .select("id, title, status, pi_user_id, institution_id")
      .eq("id", proposal_id)
      .eq("institution_id", user.institution_id)
      .single();

    if (!proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pi } = await svc
      .from("users")
      .select("id, email, full_name")
      .eq("id", proposal.pi_user_id)
      .single();

    if (!pi?.email) {
      return new Response(JSON.stringify({ error: "PI email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sentAt = new Date().toISOString();
    let letterRow: Record<string, unknown>;

    if (letter_id) {
      const { data: existing } = await svc
        .from("letters")
        .select("id, proposal_id")
        .eq("id", letter_id)
        .eq("proposal_id", proposal_id)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Letter not found for this proposal" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: updated, error: upErr } = await svc
        .from("letters")
        .update({
          content: trimmed,
          sent_at: sentAt,
          edited_by: user.id,
        })
        .eq("id", letter_id)
        .select()
        .single();

      if (upErr) throw new Error(upErr.message);
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

      if (insErr) throw new Error(insErr.message);
      letterRow = inserted as Record<string, unknown>;
    }

    let newStatus: string | null = null;
    if (transition_to_revisions_requested) {
      const allowed = ALLOWED_TRANSITIONS[proposal.status as string] || [];
      if (allowed.includes("revisions_requested")) {
        const { error: stErr } = await svc
          .from("proposals")
          .update({ status: "revisions_requested" })
          .eq("id", proposal_id);
        if (stErr) throw new Error(stErr.message);
        newStatus = "revisions_requested";

        await svc.from("audit_log").insert({
          institution_id: user.institution_id,
          user_id: user.id,
          action: "proposal_status_changed",
          entity_type: "proposal",
          entity_id: proposal_id,
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
      metadata: { proposal_id, emailed: email_pi },
    });

    let emailed = false;
    if (email_pi) {
      emailed = await sendRevisionLetterToPi(
        pi.email,
        pi.full_name ?? "",
        proposal.title as string,
        trimmed,
      );
    }

    return new Response(
      JSON.stringify({
        letter: letterRow,
        status: newStatus ?? proposal.status,
        emailed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message;
    return new Response(JSON.stringify({ error: msg }), {
      status: msg === "Unauthorized" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
