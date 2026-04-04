import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getCallerUser, getServiceClient } from "../_shared/supabase.ts";
import { createPresignedUploadUrl, generateS3Key } from "../_shared/s3.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const authHeader = req.headers.get("Authorization")!;
    const user = await getCallerUser(authHeader);
    const { proposal_id, file_name, file_type } = await req.json();

    if (!proposal_id || !file_name || !file_type) {
      return new Response(
        JSON.stringify({ error: "proposal_id, file_name, file_type required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const svc = getServiceClient();

    const { data: proposal, error: pErr } = await svc
      .from("proposals")
      .select("id, institution_id, pi_user_id")
      .eq("id", proposal_id)
      .eq("institution_id", user.institution_id)
      .single();

    if (pErr || !proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user.role === "admin" || user.role === "reviewer") {
      return new Response(
        JSON.stringify({ error: "Only the proposal owner can upload documents." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (user.id !== proposal.pi_user_id) {
      return new Response(
        JSON.stringify({ error: "Only the proposal owner can upload documents." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const s3Key = generateS3Key(proposal_id, file_name);
    const uploadUrl = createPresignedUploadUrl(s3Key);

    const { data: doc, error: docErr } = await svc
      .from("proposal_documents")
      .insert({
        proposal_id,
        file_name,
        s3_key: s3Key,
        file_type,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (docErr) {
      return new Response(JSON.stringify({ error: docErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await svc.from("audit_log").insert({
      institution_id: user.institution_id,
      user_id: user.id,
      action: "document_uploaded",
      entity_type: "proposal_document",
      entity_id: doc.id,
      metadata: {
        file_name,
        proposal_id,
      },
    });

    return new Response(
      JSON.stringify({ upload_url: uploadUrl, document_id: doc.id, s3_key: s3Key }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
