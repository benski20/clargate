import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function getUserClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

export async function getCallerUser(authHeader: string) {
  const client = getUserClient(authHeader);
  const {
    data: { user: authUser },
  } = await client.auth.getUser();
  if (!authUser) throw new Error("Unauthorized");

  const svc = getServiceClient();
  const { data: appUser, error } = await svc
    .from("users")
    .select("*")
    .eq("supabase_uid", String(authUser.id))
    .single();

  if (error || !appUser) throw new Error("User not found in app database");
  return appUser;
}
