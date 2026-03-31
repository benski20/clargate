import type { ProposalStatus } from "@/lib/types";

/** Mirrors `supabase/functions/update-status` allowed transitions. */
export const PROPOSAL_STATUS_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ["submitted"],
  submitted: ["initial_review"],
  initial_review: [
    "revisions_requested",
    "under_committee_review",
    "approved",
    "rejected",
  ],
  revisions_requested: ["resubmitted"],
  resubmitted: ["initial_review"],
  under_committee_review: ["approved", "rejected", "tabled", "revisions_requested"],
  tabled: ["under_committee_review"],
  approved: [],
  rejected: [],
};

export function isProposalStatusTransitionAllowed(
  from: ProposalStatus,
  to: ProposalStatus,
): boolean {
  const allowed = PROPOSAL_STATUS_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}
