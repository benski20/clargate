import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getCallerUser, getServiceClient } from "../_shared/supabase.ts";
import { createPresignedDownloadUrl } from "../_shared/s3.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const authHeader = req.headers.get("Authorization")!;
    const user = await getCallerUser(authHeader);
    const { proposal_id, document_id } = await req.json();

    if (!proposal_id || !document_id) {
      return new Response(
        JSON.stringify({ error: "proposal_id and document_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const svc = getServiceClient();

    const { data: proposal } = await svc
      .from("proposals")
      .select("id")
      .eq("id", proposal_id)
      .eq("institution_id", user.institution_id)
      .single();

    if (!proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: doc } = await svc
      .from("proposal_documents")
      .select("s3_key, file_name")
      .eq("id", document_id)
      .eq("proposal_id", proposal_id)
      .eq("is_deleted", false)
      .single();

    if (!doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const downloadUrl = createPresignedDownloadUrl(doc.s3_key);

    return new Response(
      JSON.stringify({ download_url: downloadUrl, file_name: doc.file_name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
