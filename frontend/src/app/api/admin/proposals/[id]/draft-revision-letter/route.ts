import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-server";
import { createServiceClient } from "@/lib/supabase-service";
import { generatePlainText } from "@/lib/server/ai";
import { buildAdminSummaryContext } from "@/lib/admin-summary-context";

export const runtime = "nodejs";

const SYSTEM_WITH_REVIEWS = `You are a professional IRB administrator drafting a revision request letter to a principal investigator (PI). Based on reviewer comments, the proposal context (including AI-extracted compliance questionnaire answers, compliance flags, and any simulated board review findings), produce a clear, respectful, and actionable letter.

Guidelines:
- Address the PI professionally
- Reference the proposal by title
- Organize revision requests by section/topic
- One numbered item per issue; each item is 1–2 short sentences (no long paragraphs)
- State what needs to change and why — skip boilerplate and repetition
- When the compliance questionnaire has skipped questions, flag those as items needing PI response
- Reference specific compliance flags or board review findings where relevant to strengthen the rationale
- Maintain a constructive, supportive tone
- End with brief submission instructions and a deadline reminder
- Do NOT make definitive regulatory determinations — frame suggestions as reviewer recommendations
- Output plain text only. Do NOT use Markdown formatting (no **asterisks**, no bullet markers like "*", no heading syntax).`;

const SYSTEM_WITHOUT_REVIEWS = `You are a professional IRB administrator drafting a revision request letter to a principal investigator (PI). No formal reviewer comments have been submitted yet — use the proposal context below (including AI review notes, compliance flags, compliance questionnaire answers, and any simulated board review findings) to identify likely gaps, missing elements, or clarifications commonly needed before IRB review.

Guidelines:
- Address the PI professionally and reference the proposal by title
- Frame items as preliminary administrative questions or clarifications (not final determinations)
- One numbered item per issue; each item is 1–2 short sentences
- When the compliance questionnaire has skipped questions or low-confidence answers, flag those as items needing PI clarification
- Reference specific compliance flags where relevant to explain why a revision is needed
- Maintain a constructive, supportive tone
- End with brief submission instructions and a deadline reminder
- Do NOT make definitive regulatory determinations
- Output plain text only. Do NOT use Markdown formatting (no **asterisks**, no bullet markers like "*", no heading syntax).`;

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

  const [{ data: reviews }, { data: documents }, { data: boardSimulations }] = await Promise.all([
    svc
      .from("reviews")
      .select("decision, comments, review_assignments!inner(proposal_id)")
      .eq("review_assignments.proposal_id", proposalId),
    svc
      .from("proposal_documents")
      .select("file_name")
      .eq("proposal_id", proposal.id)
      .order("uploaded_at", { ascending: false }),
    svc
      .from("ai_summaries")
      .select("summary")
      .eq("proposal_id", proposal.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const hasReviews = reviews && reviews.length > 0;

  const formData =
    proposal.form_data && typeof proposal.form_data === "object" && !Array.isArray(proposal.form_data)
      ? (proposal.form_data as Record<string, unknown>)
      : null;

  const documentFileNames = (documents ?? [])
    .map((d) => (typeof d.file_name === "string" ? d.file_name : ""))
    .filter(Boolean);

  const proposalContext = buildAdminSummaryContext(proposal.title, formData, {
    documentFileNames,
  });

  let userContent = `Proposal Title: ${proposal.title}\n\n`;

  if (hasReviews) {
    const reviewerComments = reviews.map((r: Record<string, unknown>) => ({
      decision: r.decision,
      comments: r.comments,
    }));
    userContent += `Reviewer Comments:\n${JSON.stringify(reviewerComments, null, 2)}\n\n`;
  }

  userContent += `Proposal Context:\n${proposalContext}`;

  const boardSummary = boardSimulations?.[0]?.summary;
  if (boardSummary && typeof boardSummary === "object") {
    const synthesis = (boardSummary as Record<string, unknown>).synthesis;
    if (synthesis) {
      userContent += `\n\nSimulated Board Review Synthesis:\n${JSON.stringify(synthesis, null, 2)}`;
    }
  }

  if (body.additional_instructions?.trim()) {
    userContent += `\n\nAdditional Instructions: ${body.additional_instructions.trim()}`;
  }

  const systemPrompt = hasReviews ? SYSTEM_WITH_REVIEWS : SYSTEM_WITHOUT_REVIEWS;

  try {
    const letterContent = await generatePlainText("revision-letter", {
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
