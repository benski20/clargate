import {
  emptyAiWorkspace,
  emptyProtocol,
  type AiWorkspaceState,
} from "@/lib/ai-proposal-types";

export type TourDemoIntakeMode = "upload" | "chat";

export type TourDemoIntakeSeed = {
  workspace: AiWorkspaceState;
  title: string;
  uploadWizardStep?: number;
  draftWizardStep?: number;
};

const BASE_PROTOCOL = {
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
};

const DEMO_ATTACHMENT = {
  id: "att-demo-1",
  name: "protocol_v2.pdf",
  mimeType: "application/pdf",
  text: "Study overview and methods for cognitive load in remote learning.",
};

const DEMO_CONSENT =
  "You are invited to participate in a research study about cognitive load during remote instruction. Your participation is voluntary. You may withdraw at any time without penalty.";

const CHAT_MESSAGES: AiWorkspaceState["messages"] = [
  { role: "assistant", content: "What is the primary aim of your study?" },
  {
    role: "user",
    content: "Measure how lecture format affects working memory in undergraduates.",
  },
  {
    role: "assistant",
    content: "Got it. Will you recruit minors, or only adults 18 and older?",
  },
];

const DEMO_TITLE = "Cognitive load in remote learning";

function complianceReady(ws: AiWorkspaceState): AiWorkspaceState {
  return {
    ...ws,
    phase: "compliance",
    predicted_category: "expedited_cat_7_behavioral_focus_groups",
    compliance_flags: [
      {
        id: "flag-1",
        severity: "info",
        message: "Confirm data retention period matches institutional policy.",
        section_key: "confidentiality",
      },
    ],
  };
}

function uploadWorkspaceForStep(step: number): TourDemoIntakeSeed {
  let ws: AiWorkspaceState = {
    ...emptyAiWorkspace(),
    phase: "intake",
    protocol: emptyProtocol(),
    context_attachments: [],
  };

  if (step >= 0) {
    ws = {
      ...ws,
      context_attachments: [DEMO_ATTACHMENT],
    };
  }
  if (step >= 1) {
    ws = {
      ...ws,
      phase: "consent",
      protocol: { ...BASE_PROTOCOL },
    };
  }
  if (step >= 2) {
    ws = { ...ws, consent_markdown: DEMO_CONSENT };
  }
  if (step >= 3) {
    ws = complianceReady(ws);
  }
  if (step >= 4) {
    ws = {
      ...ws,
      extra_materials: [
        {
          id: "extra-1",
          name: "recruitment_flyer.pdf",
          mimeType: "application/pdf",
          description: "Course announcement flyer",
        },
      ],
    };
  }
  if (step >= 5) {
    ws = { ...ws, phase: "submit" };
  }

  return {
    workspace: ws,
    title: DEMO_TITLE,
    uploadWizardStep: step,
  };
}

function chatWorkspaceForStep(step: number): TourDemoIntakeSeed {
  let ws: AiWorkspaceState = {
    ...emptyAiWorkspace(),
    phase: "intake",
    protocol: emptyProtocol(),
    messages: [],
    context_attachments: [],
    context_notes: "",
  };

  if (step >= 0) {
    // Chat materials is optional — start from scratch (unlike upload path demo).
    ws = {
      ...ws,
      context_notes:
        step === 0
          ? ""
          : "Prior IRB feedback noted — recruitment will use course announcement boards only.",
    };
  }
  if (step >= 1) {
    ws = {
      ...ws,
      messages: CHAT_MESSAGES,
      protocol: {
        ...emptyProtocol(),
        background_rationale: BASE_PROTOCOL.background_rationale,
        study_design: BASE_PROTOCOL.study_design,
      },
    };
  }
  if (step >= 3) {
    ws = {
      ...ws,
      consent_markdown: DEMO_CONSENT,
      consent_generation_declined: false,
    };
  }
  if (step >= 4) {
    ws = {
      ...ws,
      protocol: { ...BASE_PROTOCOL },
      phase: "consent",
    };
  }
  if (step >= 5) {
    ws = complianceReady(ws);
  }
  if (step >= 6) {
    ws = {
      ...ws,
      extra_materials: [
        {
          id: "extra-1",
          name: "recruitment_flyer.pdf",
          mimeType: "application/pdf",
          description: "Course announcement flyer",
        },
      ],
    };
  }
  if (step >= 7) {
    ws = { ...ws, phase: "submit" };
  }

  return {
    workspace: ws,
    title: step >= 1 ? "Working memory across lecture formats" : "",
    draftWizardStep: step,
  };
}

export function getTourDemoIntakeSeed(mode: TourDemoIntakeMode, step: number): TourDemoIntakeSeed {
  const clamped =
    mode === "upload"
      ? Math.max(0, Math.min(5, step))
      : Math.max(0, Math.min(7, step));
  return mode === "upload" ? uploadWorkspaceForStep(clamped) : chatWorkspaceForStep(clamped);
}

/** @deprecated Use getTourDemoIntakeSeed */
export const TOUR_DEMO_UPLOAD_SEED = uploadWorkspaceForStep(1);
/** @deprecated Use getTourDemoIntakeSeed */
export const TOUR_DEMO_CHAT_SEED = chatWorkspaceForStep(1);
