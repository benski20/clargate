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

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ valid: false, error: "missing_code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = code.trim().toUpperCase();
    const svc = getServiceClient();

    const { data: row, error } = await svc
      .from("signup_codes")
      .select("id, role, max_uses, uses_count, expires_at, label, institution_id")
      .eq("code", normalized)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) {
      return new Response(JSON.stringify({ valid: false, error: "invalid_code" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expiresAt = row.expires_at ? new Date(row.expires_at as string) : null;
    if (expiresAt && expiresAt < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: "expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxUses = row.max_uses as number | null;
    const uses = row.uses_count as number;
    if (maxUses != null && uses >= maxUses) {
      return new Response(JSON.stringify({ valid: false, error: "exhausted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inst } = await svc
      .from("institutions")
      .select("name")
      .eq("id", row.institution_id as string)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        valid: true,
        role: row.role,
        label: row.label,
        institution_name: inst?.name ?? "Your institution",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message;
    return new Response(JSON.stringify({ error: msg, valid: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
