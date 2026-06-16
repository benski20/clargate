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
    "Remote and hybrid instruction expanded rapidly during the COVID-19 pandemic, yet the cognitive demands of different lecture modalities remain poorly characterized in undergraduate populations. Working memory capacity is a well-established predictor of academic performance (Gathercole & Alloway, 2008), but few studies have directly compared cognitive load during synchronous video lectures versus pre-recorded asynchronous content in a controlled within-subjects design.\n\nThis study addresses that gap by measuring digit-span performance immediately after each lecture condition. Findings will inform evidence-based instructional design decisions at the departmental level and contribute to the broader scholarship on technology-mediated learning.",
  study_design:
    "Within-subjects crossover design with two conditions: synchronous lecture via live video conference and asynchronous lecture via pre-recorded video. Each participant completes both conditions in counterbalanced order, separated by a one-week washout period. The primary outcome is digit-span score (forward and backward combined) assessed immediately after each session. Secondary outcomes include self-reported cognitive fatigue (NASA-TLX subscale) and lecture comprehension (10-item quiz).",
  participants:
    "Healthy adults aged 18 to 22, currently enrolled full-time at the home institution. Target enrollment is 60 participants to achieve 80% power for detecting a medium effect size (Cohen's d = 0.5) on the primary outcome. Exclusion criteria include diagnosed attention-deficit disorder, uncorrected hearing or vision impairment, and concurrent enrollment in more than 18 credit hours.",
  recruitment:
    "Participants will be recruited via campus email listservs, course announcement boards in introductory psychology sections, and posted flyers in student common areas. A brief screening questionnaire will confirm eligibility. Interested students will receive a study information sheet before scheduling their first session.",
  procedures:
    "Each participant attends two 50-minute lecture sessions in a dedicated lab room. Session A delivers a live Zoom lecture on an introductory statistics topic; Session B delivers a pre-recorded lecture of equivalent length and difficulty on a different topic. Topic-to-condition assignment is counterbalanced across participants.\n\nImmediately following each lecture, participants complete a computerized digit-span task (forward and backward, adaptive staircase) lasting approximately 8 minutes, a 10-item content quiz, and the NASA-TLX mental demand subscale. Total time per visit is approximately 75 minutes. The second visit occurs 7 days after the first.",
  risks_benefits:
    "Risks are minimal. Participants may experience mild fatigue or boredom during the lecture and testing sessions. No physical, financial, or legal risks are anticipated. Participants may withdraw at any time without penalty.\n\nDirect benefits include a $15 gift card per session ($30 total for both visits) and optional course credit in eligible sections. Indirect benefits include contributing to research that may improve instructional design for remote learners.",
  confidentiality:
    "All data will be de-identified at the point of collection using randomly assigned participant codes. The crosswalk linking codes to identities will be stored in a password-protected file on the PI's encrypted university workstation, accessible only to the PI and one trained research assistant. De-identified datasets will be stored on the institution's secure research server (IRB-approved) for seven years after study completion, then permanently deleted. No individual results will be shared with instructors or academic advisors.",
  consent_process:
    "Prospective participants will receive the study information sheet via email after completing the screening questionnaire. Informed consent will be obtained electronically via Qualtrics at the beginning of the first lab visit, before any study procedures begin. A research assistant will be present to answer questions. Participants will receive a copy of the signed consent form by email.",
};

const DEMO_ATTACHMENTS = [
  {
    id: "att-demo-1",
    name: "protocol_v2.pdf",
    mimeType: "application/pdf",
    text: "Study Protocol: Cognitive Load During Remote Instruction\n\nPrincipal Investigator: Dr. Sarah Martinez\nDepartment of Psychology, University of Westfield\n\n1. BACKGROUND\nRemote and hybrid instruction expanded rapidly during the COVID-19 pandemic. Working memory capacity is a well-established predictor of academic performance, but few studies have directly compared cognitive load across lecture modalities in a controlled design.\n\n2. OBJECTIVES\nPrimary: Compare digit-span performance after synchronous versus asynchronous lecture conditions.\nSecondary: Assess self-reported cognitive fatigue and content comprehension.\n\n3. STUDY DESIGN\nWithin-subjects crossover with counterbalanced condition order and one-week washout.\n\n4. PARTICIPANTS\n60 healthy adults aged 18-22, enrolled full-time. Exclusions: diagnosed ADD, uncorrected sensory impairment.\n\n5. PROCEDURES\nTwo 50-minute lecture sessions in a dedicated lab. Immediate post-session digit-span task, content quiz, and NASA-TLX subscale. Total time ~75 minutes per visit.",
  },
  {
    id: "att-demo-2",
    name: "recruitment_materials.pdf",
    mimeType: "application/pdf",
    text: "RECRUITMENT FLYER\n\nAre you a full-time undergraduate student aged 18-22?\nWe are looking for participants for a study on learning and memory during online lectures.\n\nWhat's involved: Two 75-minute lab visits, one week apart\nCompensation: $15 gift card per visit ($30 total) + optional course credit\nLocation: Psychology Building, Room 204\n\nContact: studymemory@westfield.edu",
  },
];

const DEMO_CONSENT = `# Informed Consent Document

**Study Title:** Cognitive Load During Remote Instruction — A Within-Subjects Comparison
**Principal Investigator:** Dr. Sarah Martinez, Department of Psychology
**Institution:** University of Westfield
**IRB Protocol Number:** UW-2026-0842

## Purpose of the Study

You are being asked to participate in a research study examining how different lecture formats affect working memory and learning. The study aims to compare cognitive load during live video lectures versus pre-recorded lectures.

## What You Will Be Asked to Do

You will attend two lab sessions, each lasting approximately 75 minutes, scheduled one week apart. During each session you will:

- Watch a 50-minute lecture (one live via Zoom, one pre-recorded)
- Complete a brief computerized memory task (~8 minutes)
- Answer a 10-question content quiz
- Rate your mental effort on a short questionnaire

## Risks and Discomforts

Risks are minimal. You may experience mild fatigue or boredom during the lecture and testing. There are no known physical, financial, or legal risks.

## Benefits

You will receive a $15 gift card after each session ($30 total for completing both visits). Students in eligible psychology courses may receive optional course credit instead of or in addition to the gift card. Your participation will contribute to research on improving online instruction.

## Confidentiality

Your identity will be protected using a randomly assigned code. The link between your name and your code will be stored in a password-protected file accessible only to the research team. De-identified data will be retained on a secure university server for seven years, then permanently deleted.

## Voluntary Participation

Your participation is completely voluntary. You may withdraw at any time without penalty or loss of benefits. Withdrawing will not affect your academic standing or relationship with the university.

## Contact Information

Questions about the study: Dr. Sarah Martinez, studymemory@westfield.edu
Questions about your rights as a participant: University of Westfield IRB Office, irb@westfield.edu, (555) 123-4567`;

const CHAT_MESSAGES: AiWorkspaceState["messages"] = [
  {
    role: "assistant",
    content:
      "Welcome! I'll help you build your IRB protocol step by step. Let's start with the basics — what is the primary aim of your study?",
  },
  {
    role: "user",
    content:
      "I want to measure how lecture format — live Zoom versus pre-recorded video — affects working memory load in undergraduate students.",
  },
  {
    role: "assistant",
    content:
      "Great, a within-subjects comparison of lecture modalities. I've started drafting your background and study design sections. A few follow-up questions:\n\n1. What age range are you targeting, and will all participants be 18 or older?\n2. How will you measure working memory — digit span, n-back, or another task?\n3. Roughly how many participants do you plan to enroll?",
  },
  {
    role: "user",
    content:
      "Adults 18-22 only, all enrolled full-time. I'm using a computerized digit-span task (forward and backward). Aiming for 60 participants based on a power analysis for medium effect size.",
  },
  {
    role: "assistant",
    content:
      "Perfect. Since all participants are adults 18+ and data will be de-identified, this study will likely qualify for exempt review under Category 3 (benign behavioral intervention). I've updated the participants, procedures, and recruitment sections. Let me know if you'd like to adjust anything before we move to consent.",
  },
];

const DEMO_TITLE = "Cognitive load in remote instruction";

function complianceReady(ws: AiWorkspaceState): AiWorkspaceState {
  return {
    ...ws,
    phase: "compliance",
    predicted_category: "exempt_cat_3_benign_behavioral",
    compliance_flags: [
      {
        id: "flag-1",
        severity: "info",
        message:
          "Confirm that the seven-year data retention period aligns with your institution's minimum retention policy.",
        section_key: "confidentiality",
      },
      {
        id: "flag-2",
        severity: "info",
        message:
          "Verify that optional course credit does not create undue influence for students in courses taught by the PI.",
        section_key: "recruitment",
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
      context_attachments: DEMO_ATTACHMENTS,
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
          description: "Campus recruitment flyer for introductory psychology bulletin boards",
        },
        {
          id: "extra-2",
          name: "digit_span_task_description.pdf",
          mimeType: "application/pdf",
          description: "Technical specification of the adaptive digit-span assessment tool",
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
    ws = {
      ...ws,
      context_notes:
        step === 0
          ? ""
          : "Prior IRB feedback noted that recruitment should use course announcement boards only, not direct solicitation in class.",
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
        participants: BASE_PROTOCOL.participants,
        recruitment: BASE_PROTOCOL.recruitment,
        procedures: BASE_PROTOCOL.procedures,
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
          description: "Campus recruitment flyer for introductory psychology bulletin boards",
        },
        {
          id: "extra-2",
          name: "digit_span_task_description.pdf",
          mimeType: "application/pdf",
          description: "Technical specification of the adaptive digit-span assessment tool",
        },
      ],
    };
  }
  if (step >= 7) {
    ws = { ...ws, phase: "submit" };
  }

  return {
    workspace: ws,
    title: step >= 1 ? "Cognitive load in remote instruction" : "",
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
