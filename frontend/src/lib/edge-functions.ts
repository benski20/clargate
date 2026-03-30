import { createClient } from "@/lib/supabase";

/**
 * Prefer JSON body from the Edge Function over the generic invoke message.
 * Avoid `instanceof FunctionsHttpError` — Next can duplicate `@supabase/functions-js`,
 * which breaks instanceof and leaves users seeing only "non-2xx status code".
 */
async function unwrapFunctionError(error: unknown): Promise<never> {
  const errCtx = error instanceof Error ? (error as Error & { context?: unknown }).context : null;
  const isFunctionsHttp =
    error instanceof Error &&
    errCtx instanceof Response &&
    (error.name === "FunctionsHttpError" ||
      error.message === "Edge Function returned a non-2xx status code");

  if (isFunctionsHttp) {
    const res = errCtx;
    const raw = await res.clone().text().catch(() => "");
    let detail: string | undefined;
    try {
      const parsed = JSON.parse(raw) as { error?: string; message?: string };
      detail = parsed.error?.trim() || parsed.message?.trim();
    } catch {
      detail = raw?.trim() || undefined;
    }
    if (detail) throw new Error(detail);
    throw new Error(`Edge Function ${res.status} ${res.statusText}`.trim());
  }
  throw error instanceof Error ? error : new Error(String(error));
}

export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });
  if (error) await unwrapFunctionError(error);
  return data as T;
}

export async function streamEdgeFunction(
  functionName: string,
  body: Record<string, unknown>,
): Promise<ReadableStream<Uint8Array>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const res = await fetch(
    `${supabaseUrl}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anonKey || "",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Edge Function request failed");
  }

  return res.body!;
}
