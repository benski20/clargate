import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-service";
import { getPresignedDownloadUrl } from "@/lib/s3-server";

export const runtime = "nodejs";

/**
 * Presigned GET URL for a compliance certificate (PI owner or institution admin).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: certificationId } = await context.params;

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

    const { data: cert, error: certErr } = await svc
      .from("compliance_certifications")
      .select("id, user_id, institution_id, s3_key, file_name, is_deleted")
      .eq("id", certificationId)
      .single();

    if (certErr || !cert || cert.is_deleted) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }

    if (cert.institution_id !== appUser.institution_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isOwner = cert.user_id === appUser.id;
    const isAdmin = appUser.role === "admin";
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let download_url: string;
    try {
      download_url = await getPresignedDownloadUrl(cert.s3_key as string);
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
      file_name: cert.file_name as string,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Download failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
