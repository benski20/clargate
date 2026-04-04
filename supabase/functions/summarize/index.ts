import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getCallerUser, getServiceClient } from "../_shared/supabase.ts";
import { generateContent } from "../_shared/gemini.ts";

const SYSTEM_PROMPT = `You are an expert IRB (Institutional Review Board) analyst. Given a research proposal's form data, produce a structured JSON summary for IRB administrators.

Return a JSON object with these fields:
- "risk_level": "minimal" | "moderate" | "significant" — your assessment of participant risk
- "participant_population": a brief description of the study population, noting any vulnerable groups
- "methodology_summary": 2-3 sentence summary of the research methodology
- "key_concerns": array of strings, each a specific concern an IRB reviewer should examine
- "regulatory_category_suggestion": "exempt" | "expedited" | "full_board" — your recommendation for review pathway
- "regulatory_rationale": brief explanation for your category recommendation
- "study_duration_estimate": if discernible from the data
- "data_sensitivity": "low" | "medium" | "high" — based on the type of data collected

Be objective and thorough. Flag any missing information that would normally be required for IRB review.`;

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

    const { proposal_id } = await req.json();
    const svc = getServiceClient();

    const { data: proposal } = await svc
      .from("proposals")
      .select("id, title, form_data, institution_id")
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

    const userContent = `Title: ${proposal.title}\n\nForm Data:\n${JSON.stringify(proposal.form_data, null, 2)}`;
    const rawText = await generateContent(SYSTEM_PROMPT, userContent, {
      json: true,
      temperature: 0.3,
    });

    const summaryData = JSON.parse(rawText);

    const { data: aiSummary, error } = await svc
      .from("ai_summaries")
      .insert({
        proposal_id: proposal.id,
        summary: summaryData,
        model_used: "gemini-2.0-flash",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await svc.from("audit_log").insert({
      institution_id: user.institution_id,
      user_id: user.id,
      action: "ai_summary_generated",
      entity_type: "ai_summary",
      entity_id: aiSummary.id,
    });

    return new Response(
      JSON.stringify({ id: aiSummary.id, summary: summaryData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg === "Unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
