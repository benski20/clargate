import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { requireProposalDocumentAccess } from "@/lib/require-proposal-access-server";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; documentId: string; annotationId: string }> },
) {
  const { id: proposalId, annotationId } = await context.params;

  const auth = await requireProposalDocumentAccess(proposalId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const svc = createServiceClient();

  const { data: existing, error: fetchError } = await svc
    .from("document_annotations")
    .select("id, author_user_id")
    .eq("id", annotationId)
    .eq("proposal_id", proposalId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
  }

  const isAuthor = existing.author_user_id === auth.appUser.id;
  const isAdmin = auth.appUser.role === "admin";
  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestBody = await request.json();
  const { body: commentBody, is_resolved } = requestBody as {
    body?: string;
    is_resolved?: boolean;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (commentBody !== undefined) {
    updates.body = commentBody;
  }

  if (is_resolved !== undefined) {
    updates.is_resolved = is_resolved;
    updates.resolved_by = is_resolved ? auth.appUser.id : null;
    updates.resolved_at = is_resolved ? new Date().toISOString() : null;
  }

  const { data: updated, error: updateError } = await svc
    .from("document_annotations")
    .update(updates)
    .eq("id", annotationId)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
