import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-server";
import { deleteObjectFromS3 } from "@/lib/s3-server";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = (await req.json()) as {
    title?: string | null;
    body_text?: string;
    extracted_text?: string;
  };

  const { data: row, error: fetchErr } = await auth.session.supabase
    .from("institution_ai_guidance")
    .select("id, content_type")
    .eq("id", id)
    .eq("institution_id", auth.session.appUser.institution_id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.title !== undefined) {
    updates.title = typeof body.title === "string" ? body.title.trim() || null : null;
  }

  if (row.content_type === "text") {
    if (body.body_text !== undefined) {
      const text = String(body.body_text).trim();
      if (!text) {
        return NextResponse.json({ error: "body_text required" }, { status: 400 });
      }
      updates.body_text = text;
    }
  } else if (body.extracted_text !== undefined) {
    const text = String(body.extracted_text).trim();
    if (!text) {
      return NextResponse.json({ error: "extracted_text required" }, { status: 400 });
    }
    updates.extracted_text = text;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error: updateErr } = await auth.session.supabase
    .from("institution_ai_guidance")
    .update(updates)
    .eq("id", id)
    .eq("institution_id", auth.session.appUser.institution_id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await auth.session.supabase
    .from("institution_ai_guidance")
    .select("id, s3_key")
    .eq("id", id)
    .eq("institution_id", auth.session.appUser.institution_id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.s3_key) {
    try {
      await deleteObjectFromS3(row.s3_key as string);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("Missing ")) {
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }
  }

  const { error: delErr } = await auth.session.supabase
    .from("institution_ai_guidance")
    .delete()
    .eq("id", id)
    .eq("institution_id", auth.session.appUser.institution_id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
