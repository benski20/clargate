import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getCallerUser, getServiceClient } from "../_shared/supabase.ts";
import { streamContent } from "../_shared/gemini.ts";

const SYSTEM_PROMPT = `You are an AI research compliance assistant embedded in an IRB submission platform. You help principal investigators (PIs) complete their IRB proposals accurately and completely.

Your knowledge base includes:
- 45 CFR 46 (Common Rule) — federal regulations for human subjects research
- The Belmont Report — ethical principles (respect for persons, beneficence, justice)
- Common IRB submission requirements and best practices

CRITICAL GUARDRAILS:
- NEVER make definitive regulatory determinations (e.g., "your study IS exempt")
- Instead, say things like "Based on the information provided, your study MAY qualify for exempt review under category 2, but the IRB will make the final determination"
- NEVER guarantee approval outcomes
- When unsure, recommend the PI consult their institution's IRB office directly

When answering:
- Be concise and practical
- Reference specific regulations when relevant (e.g., "per 45 CFR 46.104(d)(2)")
- If the question relates to the current form section, tailor advice to that context
- Suggest specific language or approaches when helpful
- Flag common mistakes PIs make in that section`;

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const authHeader = req.headers.get("Authorization")!;
    const user = await getCallerUser(authHeader);
    const { proposal_id, question, section_context } = await req.json();

    const svc = getServiceClient();

    const { data: proposal } = await svc
      .from("proposals")
      .select("id, form_data")
      .eq("id", proposal_id)
      .eq("institution_id", user.institution_id)
      .eq("pi_user_id", user.id)
      .single();

    if (!proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userContent = `Question: ${question}`;
    if (section_context) {
      userContent = `Current section: ${section_context}\n\n${userContent}`;
    }
    if (proposal.form_data) {
      userContent += `\n\nCurrent form data:\n${JSON.stringify(proposal.form_data, null, 2)}`;
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamContent(SYSTEM_PROMPT, userContent, {
            temperature: 0.5,
          })) {
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          controller.enqueue(
            encoder.encode(`data: Error: ${(e as Error).message}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
