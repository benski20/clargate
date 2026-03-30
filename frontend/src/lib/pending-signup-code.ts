const KEY = "clargate_pending_signup_code";

export function setPendingSignupCode(code: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, code.trim().toUpperCase());
  } catch {
    /* ignore */
  }
}

export function takePendingSignupCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(KEY);
    if (v) localStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}

export function peekPendingSignupCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingSignupCode() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
