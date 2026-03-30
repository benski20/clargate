import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getCallerUser, getServiceClient } from "../_shared/supabase.ts";
import { generateContent } from "../_shared/gemini.ts";

const SYSTEM_PROMPT = `You are a professional IRB administrator drafting a revision request letter to a principal investigator (PI). Based on reviewer comments, produce a clear, respectful, and actionable letter.

Guidelines:
- Address the PI professionally
- Reference the proposal by title
- Organize revision requests by section/topic
- For each revision point, clearly state what needs to change and why
- Use numbered items for easy reference
- Maintain a constructive, supportive tone
- End with submission instructions and a deadline reminder
- Do NOT make definitive regulatory determinations — frame suggestions as reviewer recommendations`;

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

    const { proposal_id, additional_instructions } = await req.json();
    const svc = getServiceClient();

    const { data: proposal } = await svc
      .from("proposals")
      .select("id, title, form_data, institution_id")
      .eq("id", proposal_id)
      .eq("institution_id", user.institution_id)
      .single();

    if (!proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reviews } = await svc
      .from("reviews")
      .select("decision, comments, review_assignments!inner(proposal_id)")
      .eq("review_assignments.proposal_id", proposal_id);

    if (!reviews || reviews.length === 0) {
      return new Response(
        JSON.stringify({ error: "No reviews submitted for this proposal yet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const reviewerComments = reviews.map((r: Record<string, unknown>) => ({
      decision: r.decision,
      comments: r.comments,
    }));

    let userContent = `Proposal Title: ${proposal.title}\n\nReviewer Comments:\n${JSON.stringify(reviewerComments, null, 2)}`;
    if (additional_instructions) {
      userContent += `\n\nAdditional Instructions: ${additional_instructions}`;
    }

    const letterContent = await generateContent(SYSTEM_PROMPT, userContent, {
      temperature: 0.4,
    });

    const { data: letter, error } = await svc
      .from("letters")
      .insert({
        proposal_id: proposal.id,
        type: "revision",
        content: letterContent,
        generated_by_ai: true,
        edited_by: user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await svc.from("audit_log").insert({
      institution_id: user.institution_id,
      user_id: user.id,
      action: "revision_letter_drafted",
      entity_type: "letter",
      entity_id: letter.id,
    });

    return new Response(JSON.stringify(letter), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg === "Unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
