import type { AiChatMessage, ProtocolSectionKey } from "@/lib/ai-proposal-types";

export const CAYUSE_SECTIONS = [
  "core_information",
  "personnel",
  "research_focus",
  "methods",
  "subjects_recruitment",
  "data_collection",
  "data_security",
  "risks_benefits",
  "affiliations_coi",
  "consent_assent",
] as const;

export type CayuseSection = (typeof CAYUSE_SECTIONS)[number];

export const CAYUSE_SECTION_LABELS: Record<CayuseSection, string> = {
  core_information: "Core Information & Funding",
  personnel: "Personnel",
  research_focus: "Research Focus & Concepts",
  methods: "Methods",
  subjects_recruitment: "Subjects & Recruitment",
  data_collection: "Data Collection",
  data_security: "Data Security",
  risks_benefits: "Risks, Benefits & Compensation",
  affiliations_coi: "Affiliations & Conflicts of Interest",
  consent_assent: "Informed Consent & Assent",
};

export type QuestionApplicability = {
  readonly signal: string;
  readonly value: boolean;
};

export type ComplianceQuestion = {
  readonly questionId: string;
  readonly cayuseSection: CayuseSection;
  readonly questionText: string;
  readonly helpText: string;
  readonly sectionKey: ProtocolSectionKey | "consent" | "general";
  readonly applicableWhen: readonly QuestionApplicability[];
  readonly answerType: "text" | "yes_no" | "select";
  readonly selectOptions?: readonly string[];
  readonly branchParentId: string | null;
};

export type AnalysisResult = {
  readonly questionId: string;
  readonly status: "answered" | "unanswered" | "partially_answered";
  readonly extractedAnswer: string | null;
  readonly sourceDocument: string | null;
  readonly confidence: "high" | "medium" | "low";
  readonly clarificationNeeded: string | null;
};

export type QuestionnaireAnswer = {
  readonly questionId: string;
  readonly answerText: string;
  readonly answeredBy: "document_extraction" | "pi_response";
  readonly confidence: "high" | "medium" | "low";
};

export type ComplianceQuestionnaireStatus =
  | "not_started"
  | "analyzing"
  | "in_progress"
  | "complete";

export type ComplianceQuestionnaireState = {
  readonly status: ComplianceQuestionnaireStatus;
  readonly analysisResults: readonly AnalysisResult[];
  readonly messages: readonly AiChatMessage[];
  readonly answers: readonly QuestionnaireAnswer[];
  readonly activeQuestionIds: readonly string[];
  readonly skippedQuestionIds: readonly string[];
};

export function emptyQuestionnaireState(): ComplianceQuestionnaireState {
  return {
    status: "not_started",
    analysisResults: [],
    messages: [],
    answers: [],
    activeQuestionIds: [],
    skippedQuestionIds: [],
  };
}
