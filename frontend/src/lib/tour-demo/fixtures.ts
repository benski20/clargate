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
      "Shift workers in healthcare settings face chronic sleep disruption that impairs clinical judgment and patient safety. While behavioral sleep-hygiene interventions have shown promise in general populations, few randomized trials have evaluated brief, structured programs specifically designed for nurses on rotating night shifts. This study addresses that gap by testing a four-session cognitive-behavioral sleep-hygiene curriculum delivered during shift handoff periods.",
    study_design:
      "Randomized wait-list control trial over eight weeks. Participants are assigned 1:1 to immediate intervention or wait-list control. The intervention group receives four weekly 30-minute sleep-hygiene sessions; the control group receives the same intervention after the eight-week assessment. Primary outcome is the Pittsburgh Sleep Quality Index (PSQI) global score at Week 8. Secondary outcomes include Epworth Sleepiness Scale, self-reported medication errors (validated incident log), and actigraphy-measured total sleep time.",
    participants:
      "Registered nurses (RN or BSN) on rotating night shifts at the university medical center. Target enrollment: 80 participants (40 per arm) to achieve 80% power for detecting a 2-point PSQI difference (SD = 3.2). Exclusion criteria: diagnosed untreated sleep apnea, current use of prescription sleep medication, pregnancy, or planned shift-schedule change within the study period.",
    recruitment:
      "Recruitment via nursing unit bulletin boards, hospital intranet announcements, and brief presentations during existing staff meetings. Interested staff complete a REDCap screening form. Eligible participants receive the study information sheet and schedule a consent visit with a research coordinator.",
    procedures:
      "After informed consent and baseline assessments, participants are randomized using a computer-generated sequence stratified by unit. Intervention sessions are delivered by a trained sleep educator in a conference room adjacent to the nursing station during the 30-minute shift handoff window. Sessions cover sleep environment optimization, circadian rhythm management, pre-sleep routines, and stimulus control techniques. Assessments occur at baseline, Week 4, and Week 8. Actigraphy data are collected continuously via wrist-worn devices.",
    risks_benefits:
      "Risks are minimal. Participants may experience temporary discomfort discussing sleep habits. Actigraphy devices are non-invasive and FDA-cleared for consumer use. There is a small risk of breach of confidentiality. Benefits include access to a structured sleep-hygiene program, personalized sleep reports, and contribution to evidence that may improve workplace wellness policies.",
    confidentiality:
      "Data are stored on the institution's HIPAA-compliant research server with role-based access limited to the PI and two research coordinators. Participant identifiers are replaced with randomly generated codes at the point of data entry. Actigraphy data are uploaded directly to the de-identified database. The crosswalk file is stored separately in an encrypted volume. All data will be retained for seven years after study completion, then permanently deleted per institutional policy.",
    consent_process:
      "Written informed consent is obtained in person by a trained research coordinator during a private meeting in the hospital research office. Participants receive a copy of the consent form and are given at least 24 hours to consider participation before their first study visit. The consent form is available in English and Spanish.",
  },
  context_attachments: [
    {
      id: "att-demo-1",
      name: "sleep_hygiene_protocol_v3.pdf",
      mimeType: "application/pdf",
      text: "Full study protocol for the sleep-hygiene intervention trial among shift workers at the university medical center.",
    },
    {
      id: "att-demo-2",
      name: "recruitment_flyer.pdf",
      mimeType: "application/pdf",
      text: "Recruitment flyer for nursing unit bulletin boards.",
    },
  ],
  consent_markdown:
    "# Informed Consent\n\n**Study Title:** Sleep Hygiene Intervention for Nurses on Rotating Night Shifts\n**PI:** Dr. Jane Chen, School of Nursing\n\n## Purpose\nYou are being asked to participate in a study evaluating a brief sleep-hygiene program designed for nurses who work rotating night shifts.\n\n## Procedures\nYou will be randomly assigned to receive the program immediately or after an 8-week waiting period. The program consists of four 30-minute sessions during shift handoff. You will wear a wrist actigraphy device and complete questionnaires at three time points.\n\n## Risks\nRisks are minimal. You may feel mild discomfort discussing your sleep habits.\n\n## Benefits\nYou will receive a personalized sleep report and access to the intervention.\n\n## Confidentiality\nYour data will be de-identified and stored on a HIPAA-compliant server.",
  predicted_category: "exempt_cat_2_surveys_interviews",
  compliance_flags: [
    {
      id: "flag-1",
      severity: "info",
      message:
        "Confirm that the data retention period matches institutional policy and the consent form language.",
      section_key: "confidentiality",
    },
    {
      id: "flag-2",
      severity: "warning",
      message:
        "Actigraphy devices collect continuous physiological data; verify whether this constitutes a non-invasive clinical procedure under Expedited Category 4.",
      section_key: "procedures",
    },
  ],
};

function baseProposal(overrides: Partial<ProposalDetail>): ProposalDetail {
  return {
    id: TOUR_DEMO_PROPOSAL_ID,
    institution_id: INSTITUTION_ID,
    pi_user_id: "00000000-0000-4000-8000-000000000010",
    pi_name: "Dr. Jane Chen",
    title: "Sleep hygiene intervention for nurses on rotating night shifts",
    review_type: "exempt_cat_2_surveys_interviews",
    status: "initial_review",
    form_data: {
      purpose: {
        summary:
          "This study evaluates whether a brief cognitive-behavioral sleep-hygiene intervention improves sleep quality and reduces self-reported errors among nurses on rotating night shifts at the university medical center.",
      },
      methods: {
        design: "Randomized wait-list control trial over eight weeks with actigraphy and validated self-report measures.",
        participants:
          "80 registered nurses on rotating night shifts at the university medical center, randomized 1:1 to immediate intervention or wait-list control.",
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
    document_count: 4,
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
      {
        id: "doc-demo-4",
        file_name: "actigraphy_device_spec.pdf",
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
      title: "Cognitive load in remote instruction",
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
      title: "Sleep hygiene intervention for nurses on rotating night shifts",
      review_type: "exempt_cat_2_surveys_interviews",
      status: "initial_review",
      form_data: null,
      submitted_at: NOW,
      updated_at: NOW,
      created_at: NOW,
      document_count: 4,
    },
  ];
}

export function getTourDemoPiProposal(variant: "detail" | "revisions" = "detail"): ProposalDetail {
  if (variant === "revisions") {
    return baseProposal({
      status: "revisions_requested",
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
      body: "Dr. Chen, thank you for your submission. Two quick items before we proceed with review: (1) Could you confirm whether participants receive compensation beyond the personalized sleep report mentioned in the consent form? (2) Please verify that the actigraphy device model is FDA-cleared for the intended use.",
      is_read: true,
      attachments: [],
      created_at: "2026-04-07T10:00:00.000Z",
    },
    {
      id: "msg-demo-2",
      proposal_id: TOUR_DEMO_PROPOSAL_ID,
      sender_user_id: "00000000-0000-4000-8000-000000000010",
      sender_name: "Dr. Jane Chen",
      body: "Thank you for the quick turnaround. To clarify: (1) No additional monetary compensation is offered — participants receive only the personalized sleep report and the intervention itself. (2) We are using the ActiGraph wGT3X-BT, which is FDA 510(k)-cleared (K130648). I can attach the clearance letter if that would be helpful.",
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
        "Dear Dr. Chen,\n\nThank you for submitting protocol UW-2026-0315, \"Sleep Hygiene Intervention for Nurses on Rotating Night Shifts.\" The IRB has completed its initial review and requests the following revisions before the study can be approved:\n\n1. Risks section: Please expand the discussion of potential risks related to continuous actigraphy monitoring, including skin irritation and the possibility that device data could inadvertently reveal protected health information (e.g., sleep disorder indicators).\n\n2. Consent form: Update the compensation section to explicitly state that no monetary compensation is provided, as the current language could be read ambiguously.\n\n3. Data management: Clarify the specific encryption standard used for the crosswalk file (e.g., AES-256) and confirm that the research server meets institutional HIPAA security requirements.\n\nPlease submit your revised materials within 30 days. If you have questions, reply to this message or contact the IRB office directly.\n\nSincerely,\nIRB Office\nUniversity of Westfield",
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
      "Randomized wait-list control trial evaluating a four-session cognitive-behavioral sleep-hygiene curriculum for nurses on rotating night shifts. Target enrollment of 80 participants at the university medical center. Primary outcome is Pittsburgh Sleep Quality Index (PSQI) score at 8 weeks.",
    key_points: [
      "Minimal-risk behavioral intervention with validated outcome measures",
      "Actigraphy devices are FDA-cleared and non-invasive",
      "HIPAA-compliant data storage with role-based access controls",
      "Consent available in English and Spanish",
      "No monetary compensation; participants receive personalized sleep reports",
    ],
    risk_level: "Minimal",
    regulatory_category_suggestion: "Exempt Category 2 (surveys/interviews with adequate confidentiality protections)",
    data_sensitivity: "De-identified; HIPAA-compliant storage with encrypted crosswalk",
    flags: [
      {
        section_key: "confidentiality",
        severity: "info",
        message: "Confirm seven-year retention period matches institutional minimum",
      },
      {
        section_key: "procedures",
        severity: "warning",
        message: "Verify whether continuous actigraphy constitutes a non-invasive clinical procedure under Expedited Category 4",
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
      reviewer_name: "Dr. Michael Rivera",
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
      email: "m.rivera@westfield.edu",
      full_name: "Dr. Michael Rivera",
      role: "reviewer",
      is_active: true,
      created_at: NOW,
    },
    {
      id: "00000000-0000-4000-8000-000000000020",
      email: "irb.coordinator@westfield.edu",
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
        "Dear Dr. Chen,\n\nThank you for submitting protocol UW-2026-0315. The IRB has completed its initial review and requests the following revisions before the study can proceed:\n\n1. Risks section: Please expand the discussion of potential risks related to continuous actigraphy monitoring.\n\n2. Consent form: Clarify the compensation language to explicitly state no monetary payment is provided.\n\n3. Data management: Specify the encryption standard for the identity crosswalk file.\n\nPlease submit your revised materials within 30 days.",
      generated_by_ai: true,
      sent_at: null,
      approval_date: null,
      expiration_date: null,
      created_at: NOW,
    },
  ];
}
