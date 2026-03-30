/**
 * Human-readable labels and formatting for the admin audit log.
 */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  proposal_submitted: "Proposal submitted",
  proposal_resubmitted: "Proposal resubmitted",
  proposal_status_changed: "Proposal status changed",
  document_uploaded: "Document uploaded",
  reviewer_assigned: "Reviewer assigned",
  user_invited: "User invited",
  user_role_changed: "User role changed",
  revision_letter_drafted: "Revision letter drafted (AI)",
  ai_summary_generated: "AI summary generated",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

/** Short label for table "Event" column */
export function auditEventSummary(action: string, metadata: Record<string, unknown> | null): string {
  const m = metadata ?? {};
  if (action === "proposal_status_changed" && typeof m.new_status === "string") {
    if (typeof m.proposal_title === "string" && m.proposal_title) {
      return `${truncate(m.proposal_title, 40)} · ${statusLabel(m.new_status)}`;
    }
    return `Status → ${statusLabel(m.new_status)}`;
  }
  if (action === "user_role_changed" && typeof m.new_role === "string") {
    return `Role → ${m.new_role}`;
  }
  if (action === "reviewer_assigned") {
    return "Reviewer assigned to proposal";
  }
  if (action === "document_uploaded" && typeof m.file_name === "string") {
    return `Uploaded “${truncate(m.file_name, 48)}”`;
  }
  if (action === "proposal_submitted" || action === "proposal_resubmitted") {
    if (typeof m.proposal_title === "string") {
      return truncate(m.proposal_title, 56);
    }
  }
  return auditActionLabel(action);
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    initial_review: "Initial review",
    revisions_requested: "Revisions requested",
    resubmitted: "Resubmitted",
    under_committee_review: "Committee review",
    approved: "Approved",
    rejected: "Rejected",
    tabled: "Tabled",
  };
  return map[s] ?? s;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Multi-line detail text for the audit table (metadata + submission time when present).
 */
export function formatAuditDetails(
  action: string,
  metadata: Record<string, unknown> | null,
  createdAt: string,
): string {
  const lines: string[] = [];
  const m = metadata ?? {};

  if (typeof m.proposal_title === "string" && m.proposal_title) {
    lines.push(`Proposal: ${m.proposal_title}`);
  }
  if (typeof m.submitted_at === "string" && m.submitted_at) {
    lines.push(`Submitted at: ${formatInstant(m.submitted_at)}`);
  }
  if (typeof m.previous_status === "string" && typeof m.new_status === "string") {
    lines.push(`From ${statusLabel(m.previous_status)} to ${statusLabel(m.new_status)}`);
  } else if (typeof m.new_status === "string" && action === "proposal_status_changed") {
    lines.push(`New status: ${statusLabel(m.new_status)}`);
  }
  if (typeof m.file_name === "string" && m.file_name) {
    lines.push(`File: ${m.file_name}`);
  }
  if (typeof m.email === "string" && m.email) {
    lines.push(`Email: ${m.email}`);
  }
  if (typeof m.role === "string" && m.role) {
    lines.push(`Role: ${m.role}`);
  }
  if (typeof m.new_role === "string" && m.new_role) {
    lines.push(`New role: ${m.new_role}`);
  }
  if (typeof m.reviewer_id === "string" && m.reviewer_id) {
    lines.push(`Reviewer user ID: ${m.reviewer_id}`);
  }

  if (lines.length === 0) {
    const keys = Object.keys(m);
    if (keys.length > 0) {
      return keys
        .map((k) => `${k}: ${String(m[k])}`)
        .join(" · ");
    }
    return `Logged ${formatInstant(createdAt)}`;
  }

  return lines.join("\n");
}

function formatInstant(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })} (${d.toISOString()})`;
  } catch {
    return iso;
  }
}

export function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const sec = Math.round(diffMs / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 48) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 14) return `${day}d ago`;
    return d.toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}
