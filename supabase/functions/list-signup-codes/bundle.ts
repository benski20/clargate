/* Single-file bundle for MCP deploy */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function getUserClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

async function getCallerUser(authHeader: string) {
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

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = await getCallerUser(authHeader);
    const appRole = String((user as { role?: string }).role ?? "").toLowerCase();

    if (appRole !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = getServiceClient();
    const { data, error } = await svc
      .from("signup_codes")
      .select("id, code, role, max_uses, uses_count, expires_at, label, created_at")
      .eq("institution_id", user.institution_id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify(data ?? []), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    return new Response(JSON.stringify({ error: msg }), {
      status: msg === "Unauthorized" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
