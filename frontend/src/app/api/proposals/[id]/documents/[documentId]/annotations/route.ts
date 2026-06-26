import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { requireProposalDocumentAccess } from "@/lib/require-proposal-access-server";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id: proposalId, documentId } = await context.params;

  const auth = await requireProposalDocumentAccess(proposalId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const svc = createServiceClient();

  const { data: annotations, error } = await svc
    .from("document_annotations")
    .select("*, author:users!author_user_id(full_name)")
    .eq("document_id", documentId)
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const annotationIds = (annotations ?? []).map((annotation) => annotation.id);

  const { data: replies } = annotationIds.length > 0
    ? await svc
        .from("annotation_replies")
        .select("*, author:users!author_user_id(full_name)")
        .in("annotation_id", annotationIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const repliesByAnnotation = new Map<string, typeof replies>();
  for (const reply of replies ?? []) {
    const existing = repliesByAnnotation.get(reply.annotation_id) ?? [];
    existing.push(reply);
    repliesByAnnotation.set(reply.annotation_id, existing);
  }

  const result = (annotations ?? []).map((annotation) => ({
    id: annotation.id,
    proposal_id: annotation.proposal_id,
    document_id: annotation.document_id,
    author_user_id: annotation.author_user_id,
    author_name: (annotation.author as { full_name: string } | null)?.full_name ?? null,
    quoted_text: annotation.quoted_text,
    prefix_context: annotation.prefix_context,
    suffix_context: annotation.suffix_context,
    body: annotation.body,
    is_resolved: annotation.is_resolved,
    resolved_by: annotation.resolved_by,
    resolved_at: annotation.resolved_at,
    created_at: annotation.created_at,
    updated_at: annotation.updated_at,
    replies: (repliesByAnnotation.get(annotation.id) ?? []).map((reply) => ({
      id: reply.id,
      annotation_id: reply.annotation_id,
      author_user_id: reply.author_user_id,
      author_name: (reply.author as { full_name: string } | null)?.full_name ?? null,
      body: reply.body,
      created_at: reply.created_at,
    })),
  }));

  return NextResponse.json(result);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id: proposalId, documentId } = await context.params;

  const auth = await requireProposalDocumentAccess(proposalId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  if (auth.appUser.role !== "admin" && auth.appUser.role !== "reviewer") {
    return NextResponse.json({ error: "Only reviewers and admins can create annotations" }, { status: 403 });
  }

  const body = await request.json();
  const { quoted_text, prefix_context, suffix_context, body: commentBody } = body as {
    quoted_text: string;
    prefix_context: string;
    suffix_context: string;
    body: string;
  };

  if (!quoted_text || !commentBody) {
    return NextResponse.json({ error: "quoted_text and body are required" }, { status: 400 });
  }

  const svc = createServiceClient();

  const { data: annotation, error } = await svc
    .from("document_annotations")
    .insert({
      proposal_id: proposalId,
      document_id: documentId,
      author_user_id: auth.appUser.id,
      quoted_text,
      prefix_context: prefix_context ?? "",
      suffix_context: suffix_context ?? "",
      body: commentBody,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(annotation, { status: 201 });
}
