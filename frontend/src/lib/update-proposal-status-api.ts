import type { ProposalStatus } from "@/lib/types";

/** Cookie-based status update (no Supabase Edge Function / JWT). */
export async function updateProposalStatusViaApi(
  proposalId: string,
  status: ProposalStatus,
): Promise<{ status: ProposalStatus }> {
  const res = await fetch(`/api/admin/proposals/${proposalId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    credentials: "include",
  });

  const raw = await res.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : null) || raw.trim() || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  const row = data as { status?: string };
  if (!row?.status) {
    throw new Error("Invalid response");
  }

  return { status: row.status as ProposalStatus };
}
