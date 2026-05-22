import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-service";

export type PiAppUser = {
  id: string;
  institution_id: string;
  role: string;
};

export async function requirePiAppUser(): Promise<
  { ok: true; appUser: PiAppUser } | { ok: false; response: NextResponse }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user: authUser },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !authUser) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  let svc: ReturnType<typeof createServiceClient>;
  try {
    svc = createServiceClient();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 503 },
      ),
    };
  }

  const { data: appUser, error: appUserErr } = await svc
    .from("users")
    .select("id, institution_id, role")
    .eq("supabase_uid", authUser.id)
    .single();

  if (appUserErr || !appUser) {
    return { ok: false, response: NextResponse.json({ error: "User not found" }, { status: 403 }) };
  }

  if (appUser.role !== "pi") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Only investigators can manage compliance certificates." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, appUser: appUser as PiAppUser };
}
