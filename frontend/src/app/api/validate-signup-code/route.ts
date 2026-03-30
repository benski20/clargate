import { NextResponse } from "next/server";

/** Server-side anon call to PostgREST — no browser JWT / session involved. */
export async function POST(req: Request) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, error: "missing_code" });
  }
  const p_code = String(body.code ?? "").trim();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) {
    return NextResponse.json({ valid: false, error: "server_misconfigured" }, { status: 500 });
  }

  const res = await fetch(`${base}/rest/v1/rpc/validate_signup_code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ p_code }),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof payload.message === "string" ? payload.message : "validation_failed";
    return NextResponse.json({ valid: false, error: msg });
  }
  return NextResponse.json(payload);
}
