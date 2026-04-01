/** Cookie-based reviewer assignment (no Supabase Edge Function / JWT). */
export async function assignReviewersViaApi(
  proposalId: string,
  reviewerUserIds: string[],
): Promise<void> {
  const res = await fetch(`/api/admin/proposals/${proposalId}/assign-reviewers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewer_user_ids: reviewerUserIds }),
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
      (data &&
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : null) ||
      raw.trim() ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
}
