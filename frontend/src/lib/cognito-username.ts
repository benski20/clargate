async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function cognitoUsernameForEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  // Cognito pool is configured with email alias, so "username" cannot look like an email.
  const safe = normalized.replace(/[^a-z0-9]/g, "_").replace(/^_+|_+$/g, "");
  const h = (await sha256Hex(normalized)).slice(0, 10);
  return `u_${safe}_${h}`;
}

