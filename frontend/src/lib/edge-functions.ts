import { createClient } from "@/lib/supabase";

/**
 * `getSession()` can return a cached, expired `access_token`. The Edge gateway
 * then responds with "Invalid JWT". `getUser()` validates with Auth and refreshes
 * the session when needed before we send `Authorization: Bearer …`.
 */
async function getAccessTokenForEdgeFunctions(): Promise<string> {
  const supabase = createClient();

  const { error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error("Not authenticated");

  const { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshed.session?.access_token) {
      throw new Error("Not authenticated");
    }
    accessToken = refreshed.session.access_token;
  }

  return accessToken;
}

function functionsUrl(functionName: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  return `${base}/functions/v1/${functionName}`;
}

function parseEdgeErrorBody(raw: string, status: number): string {
  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string; msg?: string };
    const detail =
      (typeof parsed.error === "string" && parsed.error.trim()) ||
      (typeof parsed.message === "string" && parsed.message.trim()) ||
      (typeof parsed.msg === "string" && parsed.msg.trim());
    if (detail) return detail;
  } catch {
    /* fall through */
  }
  const t = raw?.trim();
  if (t) return t;
  return `Edge Function ${status}`;
}

export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const accessToken = await getAccessTokenForEdgeFunctions();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const doFetch = (token: string) =>
    fetch(functionsUrl(functionName), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: JSON.stringify(body),
    });

  let res = await doFetch(accessToken);

  if (res.status === 401) {
    const supabase = createClient();
    const { data: refreshed } = await supabase.auth.refreshSession();
    const next = refreshed.session?.access_token;
    if (next) {
      res = await doFetch(next);
    }
  }

  const raw = await res.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!res.ok) {
    throw new Error(parseEdgeErrorBody(raw, res.status));
  }

  return data as T;
}

export async function streamEdgeFunction(
  functionName: string,
  body: Record<string, unknown>,
): Promise<ReadableStream<Uint8Array>> {
  const accessToken = await getAccessTokenForEdgeFunctions();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const res = await fetch(functionsUrl(functionName), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(parseEdgeErrorBody(raw, res.status));
  }

  const stream = res.body;
  if (!stream) throw new Error("Edge Function returned no body");
  return stream;
}
