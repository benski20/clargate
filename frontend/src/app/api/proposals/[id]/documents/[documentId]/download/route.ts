import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { getPresignedDownloadUrl } from "@/lib/s3-server";
import { requireProposalDocumentAccess } from "@/lib/require-proposal-access-server";

export const runtime = "nodejs";

/**
 * Cookie session — presigned GET URL for S3 (PI, admin, or assigned reviewer).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const { id: proposalId, documentId } = await context.params;

    const auth = await requireProposalDocumentAccess(proposalId);
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

    const { data: doc, error: docErr } = await svc
      .from("proposal_documents")
      .select("id, proposal_id, s3_key, file_name")
      .eq("id", documentId)
      .eq("proposal_id", proposalId)
      .eq("is_deleted", false)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    let download_url: string;
    try {
      download_url = await getPresignedDownloadUrl(doc.s3_key as string);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Missing ")) {
        return NextResponse.json(
          { error: "S3 not configured (set AWS_* and S3_BUCKET_NAME on the server)" },
          { status: 503 },
        );
      }
      throw e;
    }

    return NextResponse.json({
      download_url,
      file_name: doc.file_name as string,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Download failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
