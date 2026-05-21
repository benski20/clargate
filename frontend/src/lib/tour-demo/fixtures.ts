import { emptyAiWorkspace, type AiWorkspaceState } from "@/lib/ai-proposal-types";
import type { Letter, Message, Proposal, ProposalDetail, Review, ReviewAssignment, User } from "@/lib/types";
import { TOUR_DEMO_PROPOSAL_ID } from "./constants";

const NOW = "2026-04-08T14:30:00.000Z";
const INSTITUTION_ID = "00000000-0000-4000-8000-000000000001";

const uploadWorkspace: AiWorkspaceState = {
  ...emptyAiWorkspace(),
  phase: "consent",
  messages: [],
  protocol: {
    background_rationale:
      "Remote instruction expanded rapidly; working memory load during synchronous vs asynchronous lectures is understudied in undergraduate populations.",
    study_design:
      "Within-subjects design: participants complete a digit-span task after each lecture format condition.",
    participants: "Healthy adults aged 18–22 enrolled at the home institution.",
    recruitment: "Campus email and course announcement boards; voluntary participation.",
    procedures:
      "Two 45-minute lecture sessions (live Zoom vs recorded) spaced one week apart, followed by cognitive testing.",
    risks_benefits:
      "Minimal risk — mild fatigue. Benefits include contributing to instructional design research.",
    confidentiality: "De-identified data stored on encrypted institutional servers for seven years.",
    consent_process: "Electronic consent via Qualtrics before scheduling.",
  },
  context_attachments: [
    {
      id: "att-demo-1",
      name: "protocol_v2.pdf",
      mimeType: "application/pdf",
      text: "Study overview and methods for cognitive load in remote learning.",
    },
  ],
  consent_markdown:
    "You are invited to participate in a research study about cognitive load during remote instruction. Your participation is voluntary.",
  predicted_category: "expedited",
  compliance_flags: [
    {
      id: "flag-1",
      severity: "info",
      message: "Confirm data retention period matches institutional policy.",
      section_key: "confidentiality",
    },
  ],
};

function baseProposal(overrides: Partial<ProposalDetail>): ProposalDetail {
  return {
    id: TOUR_DEMO_PROPOSAL_ID,
    institution_id: INSTITUTION_ID,
    pi_user_id: "00000000-0000-4000-8000-000000000010",
    pi_name: "Dr. Jane Chen",
    title: "Sleep hygiene in shift workers",
    review_type: "expedited",
    status: "initial_review",
    form_data: {
      purpose: {
        summary:
          "This study evaluates whether a brief sleep-hygiene intervention improves alertness among nurses on rotating night shifts.",
      },
      methods: {
        design: "Randomized wait-list control trial over eight weeks.",
        participants: "Registered nurses on rotating night shifts at the university medical center.",
      },
      submission_snapshot: {
        file_name: "sleep-hygiene-submission.docx",
        docx_file_name: "sleep-hygiene-submission.docx",
        pdf_file_name: "sleep-hygiene-submission.pdf",
        submitted_at: NOW,
      },
      ai_workspace: uploadWorkspace,
    },
    submitted_at: NOW,
    updated_at: NOW,
    created_at: NOW,
    document_count: 3,
    documents: [
      {
        id: "doc-demo-1",
        file_name: "sleep-hygiene-submission.docx",
        file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        uploaded_at: NOW,
      },
      {
        id: "doc-demo-2",
        file_name: "sleep-hygiene-submission.pdf",
        file_type: "application/pdf",
        uploaded_at: NOW,
      },
      {
        id: "doc-demo-3",
        file_name: "recruitment_flyer.pdf",
        file_type: "application/pdf",
        uploaded_at: NOW,
      },
    ],
    ...overrides,
  };
}

const TOUR_DEMO_DRAFT_ID = "platform-tour-demo-draft";

export function getTourDemoPiProposalsList(): Proposal[] {
  return [
    {
      id: TOUR_DEMO_DRAFT_ID,
      institution_id: INSTITUTION_ID,
      pi_user_id: "00000000-0000-4000-8000-000000000010",
      pi_name: "Dr. Jane Chen",
      title: "Working memory across lecture formats",
      review_type: null,
      status: "draft",
      form_data: null,
      submitted_at: null,
      updated_at: "2026-04-08T12:20:00.000Z",
      created_at: "2026-04-08T11:45:00.000Z",
      document_count: 0,
    },
    {
      id: TOUR_DEMO_PROPOSAL_ID,
      institution_id: INSTITUTION_ID,
      pi_user_id: "00000000-0000-4000-8000-000000000010",
      pi_name: "Dr. Jane Chen",
      title: "Sleep hygiene in shift workers",
      review_type: "expedited",
      status: "initial_review",
      form_data: null,
      submitted_at: NOW,
      updated_at: NOW,
      created_at: NOW,
      document_count: 3,
    },
  ];
}

export function getTourDemoPiProposal(variant: "detail" | "revisions" = "detail"): ProposalDetail {
  if (variant === "revisions") {
    return baseProposal({
      status: "revisions_requested",
      title: "Sleep hygiene in shift workers",
    });
  }
  return baseProposal({});
}

export function getTourDemoPiMessages(): Message[] {
  return [
    {
      id: "msg-demo-1",
      proposal_id: TOUR_DEMO_PROPOSAL_ID,
      sender_user_id: "00000000-0000-4000-8000-000000000020",
      sender_name: "IRB Coordinator",
      body: "Could you confirm whether participants receive compensation?",
      is_read: true,
      attachments: [],
      created_at: "2026-04-07T10:00:00.000Z",
    },
    {
      id: "msg-demo-2",
      proposal_id: TOUR_DEMO_PROPOSAL_ID,
      sender_user_id: "00000000-0000-4000-8000-000000000010",
      sender_name: "Dr. Jane Chen",
      body: "Yes — $25 gift card after completion.",
      is_read: true,
      attachments: [],
      created_at: "2026-04-08T09:15:00.000Z",
    },
  ];
}

export function getTourDemoPiLetters(variant: "detail" | "revisions"): Letter[] {
  if (variant !== "revisions") return [];
  return [
    {
      id: "letter-demo-1",
      proposal_id: TOUR_DEMO_PROPOSAL_ID,
      type: "revision",
      content:
        "Dear Dr. Chen,\n\nThank you for your submission. Please revise the risks section to address potential fatigue during driving after night shifts, and update the consent form to reflect the revised compensation schedule.\n\nSincerely,\nIRB Office",
      generated_by_ai: false,
      sent_at: "2026-04-06T16:00:00.000Z",
      approval_date: null,
      expiration_date: null,
      created_at: "2026-04-06T15:55:00.000Z",
    },
  ];
}

export function getTourDemoAdminSummary(): Record<string, unknown> {
  return {
    overview:
      "Minimal-risk survey study with anonymous online data collection. Expedited review category appropriate.",
    key_points: [
      "Anonymous online survey; minimal risk",
      "Expedited review category predicted",
      "Consent covers optional demographic items",
    ],
    risk_level: "Minimal",
    regulatory_category_suggestion: "Expedited",
    data_sensitivity: "De-identified responses",
    flags: [
      {
        section_key: "confidentiality",
        severity: "warning",
        message: "Confirm data storage location matches institutional policy",
      },
    ],
  };
}

export function getTourDemoReviewAssignments(): ReviewAssignment[] {
  return [
    {
      id: "assign-demo-1",
      proposal_id: TOUR_DEMO_PROPOSAL_ID,
      reviewer_user_id: "00000000-0000-4000-8000-000000000030",
      reviewer_name: "Dr. Rivera",
      status: "in_progress",
      assigned_at: "2026-04-05T12:00:00.000Z",
    },
  ];
}

export function getTourDemoReviews(): Review[] {
  return [];
}

export function getTourDemoInstitutionUsers(): User[] {
  return [
    {
      id: "00000000-0000-4000-8000-000000000030",
      email: "rivera@example.edu",
      full_name: "Dr. Rivera",
      role: "reviewer",
      is_active: true,
      created_at: NOW,
    },
    {
      id: "00000000-0000-4000-8000-000000000020",
      email: "coordinator@example.edu",
      full_name: "IRB Coordinator",
      role: "admin",
      is_active: true,
      created_at: NOW,
    },
  ];
}

export function getTourDemoAdminLetters(): Letter[] {
  return [
    {
      id: "letter-draft-1",
      proposal_id: TOUR_DEMO_PROPOSAL_ID,
      type: "revision",
      content:
        "Dear Dr. Chen,\n\nThank you for your submission. The board requests the following revisions before approval…",
      generated_by_ai: true,
      sent_at: null,
      approval_date: null,
      expiration_date: null,
      created_at: NOW,
    },
  ];
}
