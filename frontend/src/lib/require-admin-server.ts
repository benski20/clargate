import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminSession = {
  supabase: SupabaseClient;
  appUser: { id: string; institution_id: string; role: string };
};

export async function requireAdminSession(): Promise<
  { ok: true; session: AdminSession } | { ok: false; status: 401 | 403; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const { data: appUser, error } = await supabase
    .from("users")
    .select("id, institution_id, role")
    .eq("supabase_uid", user.id)
    .single();

  if (error || !appUser) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  const role = appUser.role as string;
  if (role !== "admin") {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return {
    ok: true,
    session: {
      supabase,
      appUser: {
        id: appUser.id as string,
        institution_id: appUser.institution_id as string,
        role: appUser.role as string,
      },
    },
  };
}
