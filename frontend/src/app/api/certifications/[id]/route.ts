import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";

/** Soft-delete a compliance certificate (PI owner only). S3 object is retained. */
export async function DELETE(
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

    if (appUser.role !== "pi") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: cert, error: certErr } = await svc
      .from("compliance_certifications")
      .select("id, user_id, institution_id, file_name, is_deleted")
      .eq("id", certificationId)
      .single();

    if (certErr || !cert || cert.is_deleted) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }

    if (cert.user_id !== appUser.id || cert.institution_id !== appUser.institution_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: updateErr } = await svc
      .from("compliance_certifications")
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", certificationId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await svc.from("audit_log").insert({
      institution_id: appUser.institution_id,
      user_id: appUser.id,
      action: "certification_deleted",
      entity_type: "compliance_certification",
      entity_id: certificationId,
      metadata: { file_name: cert.file_name },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
