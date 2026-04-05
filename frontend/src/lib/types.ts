export type UserRole = "admin" | "reviewer" | "pi";

export type ProposalStatus =
  | "draft"
  | "submitted"
  | "initial_review"
  | "revisions_requested"
  | "resubmitted"
  | "under_committee_review"
  | "approved"
  | "rejected"
  | "tabled";

export type ReviewType = "exempt" | "expedited" | "full_board" | "not_sure";

export type ReviewDecision =
  | "approve"
  | "minor_modifications"
  | "revisions_required"
  | "reject"
  | "table";

export type AssignmentStatus = "not_started" | "in_progress" | "submitted";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

/** Institutional signup code (admin-created). */
export interface SignupCodeRow {
  id: string;
  code: string;
  role: UserRole;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  label: string | null;
  created_at: string;
}

export type RedeemSignupResult = {
  ok: boolean;
  error?: string;
  already_redeemed?: boolean;
  role?: UserRole;
  institution_id?: string;
};

export interface Institution {
  id: string;
  name: string;
  created_at: string;
}

export interface Proposal {
  id: string;
  institution_id: string;
  pi_user_id: string;
  pi_name: string | null;
  title: string;
  review_type: ReviewType | null;
  status: ProposalStatus;
  form_data: Record<string, unknown> | null;
  submitted_at: string | null;
  updated_at: string;
  created_at: string;
  document_count: number;
  /** PI hid this draft from their list; row is not deleted. */
  hidden_from_pi_at?: string | null;
}

export interface ProposalDocument {
  id: string;
  file_name: string;
  file_type: string;
  uploaded_at: string;
}

export interface ProposalDetail extends Proposal {
  documents: ProposalDocument[];
}

export interface ReviewAssignment {
  id: string;
  proposal_id: string;
  reviewer_user_id: string;
  reviewer_name: string | null;
  status: AssignmentStatus;
  assigned_at: string;
}

export interface Review {
  id: string;
  assignment_id: string;
  decision: ReviewDecision;
  comments: Record<string, unknown>;
  submitted_at: string;
}

export interface Message {
  id: string;
  proposal_id: string;
  sender_user_id: string;
  sender_name: string | null;
  body: string;
  is_read: boolean;
  attachments: { id: string; file_name: string }[];
  created_at: string;
}

export interface InboxItem {
  proposal_id: string;
  proposal_title: string;
  last_message_body: string | null;
  last_message_sender_name: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface Letter {
  id: string;
  proposal_id: string;
  type: "revision" | "approval";
  content: string;
  generated_by_ai: boolean;
  sent_at: string | null;
  approval_date: string | null;
  expiration_date: string | null;
  created_at: string;
}

export type InstitutionAiGuidanceCategory =
  | "example_proposal"
  | "rules"
  | "guidelines"
  | "institutional";

/** Row in `institution_ai_guidance` (admin-managed AI context). */
export interface InstitutionAiGuidanceRow {
  id: string;
  institution_id: string;
  category: InstitutionAiGuidanceCategory;
  title: string | null;
  content_type: "text" | "file";
  body_text: string | null;
  file_name: string | null;
  s3_key: string | null;
  mime_type: string | null;
  extracted_text: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  /** Normalized from `metadata` or `metadata_` column */
  metadata_: Record<string, unknown> | null;
  created_at: string;
  /** Same-institution user row when `user_id` is set */
  actor?: { full_name: string | null; email: string } | null;
}

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  initial_review: "Initial Review",
  revisions_requested: "Revisions Requested",
  resubmitted: "Resubmitted",
  under_committee_review: "Committee Review",
  approved: "Approved",
  rejected: "Rejected",
  tabled: "Tabled",
};

/** Monochrome status chips — contrast via gray scale only */
export const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-neutral-200/90 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
  initial_review: "bg-neutral-200/90 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
  revisions_requested: "bg-neutral-300/80 text-neutral-950 dark:bg-neutral-600 dark:text-neutral-50",
  resubmitted: "bg-neutral-200/90 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
  under_committee_review: "bg-neutral-300/80 text-neutral-950 dark:bg-neutral-600 dark:text-neutral-50",
  approved: "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900",
  rejected: "bg-neutral-400/40 text-neutral-950 dark:bg-neutral-500/50 dark:text-neutral-50",
  tabled: "bg-muted text-muted-foreground",
};
