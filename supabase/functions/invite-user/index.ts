import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getCallerUser, getServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const authHeader = req.headers.get("Authorization")!;
    const user = await getCallerUser(authHeader);

    if (user.role !== "admin" && user.role !== "reviewer") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, full_name, role } = await req.json();
    const svc = getServiceClient();

    const { data: existing } = await svc
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "User with this email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pendingUid = `pending_${crypto.randomUUID().slice(0, 12)}`;

    const { data: newUser, error } = await svc
      .from("users")
      .insert({
        supabase_uid: pendingUid,
        institution_id: user.institution_id,
        email,
        full_name,
        role,
        invited_by: user.id,
        is_active: false,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await svc.from("audit_log").insert({
      institution_id: user.institution_id,
      user_id: user.id,
      action: "user_invited",
      entity_type: "user",
      entity_id: newUser.id,
      metadata: { email, role },
    });

    return new Response(JSON.stringify(newUser), {
      status: 201,
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
