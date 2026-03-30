import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-server";
import type { InstitutionAiGuidanceCategory } from "@/lib/types";

const CATEGORIES: InstitutionAiGuidanceCategory[] = [
  "example_proposal",
  "rules",
  "guidelines",
  "institutional",
];

function isCategory(s: string): s is InstitutionAiGuidanceCategory {
  return CATEGORIES.includes(s as InstitutionAiGuidanceCategory);
}

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { data, error } = await auth.session.supabase
    .from("institution_ai_guidance")
    .select("*")
    .eq("institution_id", auth.session.appUser.institution_id)
    .order("category")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await req.json()) as {
    category?: string;
    title?: string;
    body_text?: string;
  };

  const category = String(body.category ?? "");
  if (!isCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const text = String(body.body_text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "body_text required" }, { status: 400 });
  }

  const { data, error } = await auth.session.supabase
    .from("institution_ai_guidance")
    .insert({
      institution_id: auth.session.appUser.institution_id,
      category,
      title: body.title?.trim() || null,
      content_type: "text",
      body_text: text,
      created_by: auth.session.appUser.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}
