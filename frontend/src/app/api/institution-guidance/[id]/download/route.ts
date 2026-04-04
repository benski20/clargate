import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getPresignedDownloadUrl } from "@/lib/s3-server";

export const runtime = "nodejs";

/**
 * Presigned GET for an institutional guidance file (PI/admin/reviewer, same institution via RLS).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: guidanceId } = await context.params;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: appUser, error: userErr } = await supabase
      .from("users")
      .select("id, institution_id, role")
      .eq("supabase_uid", user.id)
      .single();

    if (userErr || !appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 403 });
    }

    if (appUser.role !== "pi" && appUser.role !== "admin" && appUser.role !== "reviewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: row, error: rowErr } = await supabase
      .from("institution_ai_guidance")
      .select("id, institution_id, s3_key, file_name, content_type")
      .eq("id", guidanceId)
      .single();

    if (rowErr || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (row.content_type !== "file" || !row.s3_key) {
      return NextResponse.json({ error: "No file for this entry" }, { status: 400 });
    }

    if (row.institution_id !== appUser.institution_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let download_url: string;
    try {
      download_url = await getPresignedDownloadUrl(row.s3_key as string);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Missing ")) {
        return NextResponse.json(
          { error: "S3 not configured (set AWS_* and S3_BUCKET_NAME on the server)" },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({
      download_url,
      file_name: (row.file_name as string) || "download",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
