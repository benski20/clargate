import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { requireProposalDocumentAccess } from "@/lib/require-proposal-access-server";
import { getS3Client, getBucketName } from "@/lib/s3-server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { convertPdfToHtml } from "@/lib/server/document-to-html";

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

  let svc: ReturnType<typeof createServiceClient>;
  try {
    svc = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  }

  const { data: document, error: documentError } = await svc
    .from("proposal_documents")
    .select("id, proposal_id, s3_key, file_name, file_type")
    .eq("id", documentId)
    .eq("proposal_id", proposalId)
    .eq("is_deleted", false)
    .single();

  if (documentError || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const s3Response = await getS3Client().send(
      new GetObjectCommand({ Bucket: getBucketName(), Key: document.s3_key as string }),
    );
    const bytes = await s3Response.Body!.transformToByteArray();
    const buffer = Buffer.from(bytes);

    const fileType = document.file_type as string;
    const isDocx = fileType.includes("word") || fileType.includes("docx");

    if (isDocx) {
      const base64 = buffer.toString("base64");
      return NextResponse.json({ docx_base64: base64, file_type: fileType });
    }

    const html = await convertPdfToHtml(buffer);
    return NextResponse.json({ html, file_type: fileType });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed";
    if (message.includes("Missing ")) {
      return NextResponse.json({ error: "S3 not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
