import { createBrowserClient } from "@supabase/ssr";

export function getAppOrigin() {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Call `validate_signup_code` without attaching the user session JWT.
 * The default browser client sends `Authorization: Bearer <session>` when a
 * session exists; if it is expired, PostgREST returns "Invalid JWT" before
 * the `anon` RPC grant is considered. Public signup validation must use anon only.
 */
export async function rpcValidateSignupCodeAnonOnly(p_code: string): Promise<{
  valid: boolean;
  error?: string;
  role?: string;
  label?: string | null;
  institution_name?: string;
}> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await fetch(`${base}/rest/v1/rpc/validate_signup_code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ p_code }),
  });
  const payload = (await res.json().catch(() => null)) as
    | { message?: string; hint?: string; details?: string; code?: string }
    | {
        valid: boolean;
        error?: string;
        role?: string;
        label?: string | null;
        institution_name?: string;
      }
    | null;

  if (!res.ok) {
    const msg =
      (payload && "message" in payload && typeof payload.message === "string" && payload.message) ||
      (payload && "hint" in payload && typeof payload.hint === "string" && payload.hint) ||
      res.statusText;
    throw new Error(msg || "validate_signup_code failed");
  }

  return payload as {
    valid: boolean;
    error?: string;
    role?: string;
    label?: string | null;
    institution_name?: string;
  };
}
