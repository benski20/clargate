import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInstitutionGuidanceForModel } from "@/lib/institution-guidance-format";
import type { InstitutionAiGuidanceCategory } from "@/lib/types";

type GuidanceRow = {
  category: InstitutionAiGuidanceCategory;
  title: string | null;
  content_type: "text" | "file";
  body_text: string | null;
  file_name: string | null;
  extracted_text: string | null;
};

/**
 * Loads institution-scoped AI guidance for the signed-in user (PI/admin).
 * Uses RLS: only same-institution rows are returned.
 */
export async function loadInstitutionGuidanceForModel(supabase: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "";

  const { data: appUser, error: uErr } = await supabase
    .from("users")
    .select("institution_id")
    .eq("supabase_uid", user.id)
    .maybeSingle();

  if (uErr || !appUser?.institution_id) return "";

  const { data: rows, error } = await supabase
    .from("institution_ai_guidance")
    .select("category, title, content_type, body_text, file_name, extracted_text")
    .eq("institution_id", appUser.institution_id)
    .order("category", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[institution_ai_guidance]", error.message);
    return "";
  }
  if (!rows?.length) return "";

  return formatInstitutionGuidanceForModel(rows as GuidanceRow[]);
}
