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

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "CLG-";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) {
    s += chars[arr[i]! % chars.length];
  }
  return s;
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

    if (appRole !== "admin" && appRole !== "reviewer") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const role = (body.role as string) || "pi";
    if (!["pi", "reviewer", "admin"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawMax = body.max_uses;
    const maxUses = rawMax != null && rawMax !== "" ? Number(rawMax) : null;
    if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1)) {
      return new Response(JSON.stringify({ error: "max_uses must be a positive number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const expiresAt = body.expires_at ? String(body.expires_at) : null;
    const label = body.label != null ? String(body.label) : null;

    const svc = getServiceClient();
    let code = randomCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await svc
        .from("signup_codes")
        .insert({
          code,
          institution_id: user.institution_id,
          role,
          max_uses: Number.isFinite(maxUses as number) ? maxUses : null,
          expires_at: expiresAt,
          label,
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (!error && data) {
        return new Response(JSON.stringify(data), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (error?.code !== "23505") {
        throw new Error(error?.message ?? "insert failed");
      }
      code = randomCode();
    }

    throw new Error("Could not generate unique code");
  } catch (e) {
    const msg = (e as Error).message;
    return new Response(JSON.stringify({ error: msg }), {
      status: msg === "Unauthorized" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
