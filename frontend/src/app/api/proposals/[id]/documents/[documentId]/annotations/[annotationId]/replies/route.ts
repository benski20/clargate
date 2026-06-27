import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { requireProposalDocumentAccess } from "@/lib/require-proposal-access-server";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; documentId: string; annotationId: string }> },
) {
  const { id: proposalId, documentId, annotationId } = await context.params;

  const auth = await requireProposalDocumentAccess(proposalId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const svc = createServiceClient();

  const { data: annotation, error: annotationError } = await svc
    .from("document_annotations")
    .select("id")
    .eq("id", annotationId)
    .eq("proposal_id", proposalId)
    .eq("document_id", documentId)
    .single();

  if (annotationError || !annotation) {
    return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
  }

  const requestBody = await request.json();
  const { body: replyBody } = requestBody as { body: string };

  if (!replyBody) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const { data: reply, error: insertError } = await svc
    .from("annotation_replies")
    .insert({
      annotation_id: annotationId,
      author_user_id: auth.appUser.id,
      body: replyBody,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(reply, { status: 201 });
}
