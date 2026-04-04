import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-server";
import { createServiceClient } from "@/lib/supabase-service";
import { generatePlainText } from "@/lib/server/gemini";

export const runtime = "nodejs";

const SYSTEM_WITH_REVIEWS = `You are a professional IRB administrator drafting a revision request letter to a principal investigator (PI). Based on reviewer comments, produce a clear, respectful, and actionable letter.

Guidelines:
- Address the PI professionally
- Reference the proposal by title
- Organize revision requests by section/topic
- For each revision point, clearly state what needs to change and why
- Use numbered items for easy reference
- Maintain a constructive, supportive tone
- End with submission instructions and a deadline reminder
- Do NOT make definitive regulatory determinations — frame suggestions as reviewer recommendations`;

const SYSTEM_WITHOUT_REVIEWS = `You are a professional IRB administrator drafting a revision request letter to a principal investigator (PI). No formal reviewer comments have been submitted yet — use the protocol intake data below to identify likely gaps, missing elements, or clarifications commonly needed before IRB review.

Guidelines:
- Address the PI professionally and reference the proposal by title
- Frame items as preliminary administrative questions or clarifications (not final determinations)
- Use numbered items for easy reference
- Maintain a constructive, supportive tone
- End with submission instructions and a deadline reminder
- Do NOT make definitive regulatory determinations`;

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
    additional_instructions?: string;
  };

  const { data: proposal, error: pErr } = await svc
    .from("proposals")
    .select("id, title, form_data, institution_id")
    .eq("id", proposalId)
    .eq("institution_id", auth.session.appUser.institution_id)
    .neq("status", "draft")
    .single();

  if (pErr || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const { data: reviews } = await svc
    .from("reviews")
    .select("decision, comments, review_assignments!inner(proposal_id)")
    .eq("review_assignments.proposal_id", proposalId);

  const hasReviews = reviews && reviews.length > 0;

  let userContent: string;
  if (hasReviews) {
    const reviewerComments = reviews.map((r: Record<string, unknown>) => ({
      decision: r.decision,
      comments: r.comments,
    }));
    userContent = `Proposal Title: ${proposal.title}\n\nReviewer Comments:\n${JSON.stringify(reviewerComments, null, 2)}`;
  } else {
    userContent = `Proposal Title: ${proposal.title}\n\nProtocol / intake data:\n${JSON.stringify(proposal.form_data, null, 2)}`;
  }
  if (body.additional_instructions?.trim()) {
    userContent += `\n\nAdditional Instructions: ${body.additional_instructions.trim()}`;
  }

  const systemPrompt = hasReviews ? SYSTEM_WITH_REVIEWS : SYSTEM_WITHOUT_REVIEWS;

  try {
    const letterContent = await generatePlainText({
      systemInstruction: systemPrompt,
      userText: userContent,
      temperature: 0.4,
    });

    const { data: letter, error: insErr } = await svc
      .from("letters")
      .insert({
        proposal_id: proposal.id,
        type: "revision",
        content: letterContent,
        generated_by_ai: true,
        edited_by: auth.session.appUser.id,
      })
      .select()
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    await svc.from("audit_log").insert({
      institution_id: auth.session.appUser.institution_id,
      user_id: auth.session.appUser.id,
      action: "revision_letter_drafted",
      entity_type: "letter",
      entity_id: letter.id,
    });

    return NextResponse.json(letter);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Draft failed" },
      { status: 500 },
    );
  }
}
