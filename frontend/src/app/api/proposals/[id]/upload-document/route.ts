import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-service";
import { generateS3Key, putObjectToS3 } from "@/lib/s3-server";

export const runtime = "nodejs";

const MAX_BYTES = 16 * 1024 * 1024;

/**
 * Upload a file to S3 and insert `proposal_documents` using the server session (cookies).
 * No Supabase Edge Function or Authorization: Bearer to functions — AWS credentials stay server-only.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: proposalId } = await context.params;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user: authUser },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const { data: appUser, error: appUserErr } = await svc
      .from("users")
      .select("id, institution_id, role")
      .eq("supabase_uid", authUser.id)
      .single();

    if (appUserErr || !appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 403 });
    }

    if (appUser.role === "admin") {
      return NextResponse.json(
        { error: "Administrators cannot upload proposal documents." },
        { status: 403 },
      );
    }

    const { data: proposal, error: pErr } = await svc
      .from("proposals")
      .select("id, institution_id, pi_user_id")
      .eq("id", proposalId)
      .eq("institution_id", appUser.institution_id)
      .single();

    if (pErr || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (appUser.id !== proposal.pi_user_id) {
      return NextResponse.json(
        { error: "Only the proposal owner can upload documents." },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "file field required" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    const fileName = file instanceof File && file.name ? file.name : "upload.bin";
    const fileType = file.type || "application/octet-stream";

    const arrayBuffer = await file.arrayBuffer();
    const body = Buffer.from(arrayBuffer);

    const s3Key = generateS3Key(proposalId, fileName);
    try {
      await putObjectToS3({ key: s3Key, body, contentType: fileType });
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

    const { data: doc, error: docErr } = await svc
      .from("proposal_documents")
      .insert({
        proposal_id: proposalId,
        file_name: fileName,
        s3_key: s3Key,
        file_type: fileType,
        uploaded_by: appUser.id,
      })
      .select()
      .single();

    if (docErr) {
      return NextResponse.json({ error: docErr.message }, { status: 500 });
    }

    await svc.from("audit_log").insert({
      institution_id: appUser.institution_id,
      user_id: appUser.id,
      action: "document_uploaded",
      entity_type: "proposal_document",
      entity_id: doc.id,
      metadata: {
        file_name: fileName,
        proposal_id: proposalId,
      },
    });

    return NextResponse.json({
      document_id: doc.id,
      s3_key: s3Key,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
