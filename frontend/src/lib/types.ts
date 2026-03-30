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

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata_: Record<string, unknown> | null;
  created_at: string;
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

export const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-800",
  initial_review: "bg-cyan-100 text-cyan-800",
  revisions_requested: "bg-amber-100 text-amber-800",
  resubmitted: "bg-indigo-100 text-indigo-800",
  under_committee_review: "bg-purple-100 text-purple-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  tabled: "bg-slate-100 text-slate-800",
};
