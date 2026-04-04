/** AI-assisted draft flow stored under proposal.form_data.ai_workspace */

export const PROTOCOL_SECTION_KEYS = [
  "background_rationale",
  "study_design",
  "participants",
  "recruitment",
  "procedures",
  "risks_benefits",
  "confidentiality",
  "consent_process",
] as const;

export type ProtocolSectionKey = (typeof PROTOCOL_SECTION_KEYS)[number];

export type ProtocolDraft = Record<ProtocolSectionKey, string>;

export type AiChatMessage = { role: "user" | "assistant"; content: string };

export type ComplianceFlag = {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  section_key: ProtocolSectionKey | "consent" | "general";
  cfr_reference?: string;
  actionable?: string;
};

export type ContextAttachment = {
  id: string;
  name: string;
  mimeType: string;
  /** Extracted plain text (PDF/text files); sent to Gemini. */
  text: string;
  /** Legacy: optional if an older session stored via presign-upload. */
  document_id?: string;
  s3_key?: string;
};

export type AiWorkspaceState = {
  version: 2;
  phase: "intake" | "consent" | "compliance" | "submit";
  messages: AiChatMessage[];
  protocol: ProtocolDraft;
  /** Freeform notes included in every Gemini call. */
  context_notes: string;
  /** Uploaded materials (text extracted client- or server-side). */
  context_attachments: ContextAttachment[];
  consent_markdown: string | null;
  consent_missing: string[];
  predicted_category: "exempt" | "expedited" | "full_board" | null;
  compliance_flags: ComplianceFlag[];
  last_intake_focus?: string;
};

export function emptyProtocol(): ProtocolDraft {
  return {
    background_rationale: "",
    study_design: "",
    participants: "",
    recruitment: "",
    procedures: "",
    risks_benefits: "",
    confidentiality: "",
    consent_process: "",
  };
}

export function emptyAiWorkspace(): AiWorkspaceState {
  return {
    version: 2,
    phase: "intake",
    messages: [],
    protocol: emptyProtocol(),
    context_notes: "",
    context_attachments: [],
    consent_markdown: null,
    consent_missing: [],
    predicted_category: null,
    compliance_flags: [],
  };
}

/** Normalize stored workspace from DB (older versions or partial saves). */
export function normalizeAiWorkspace(raw: unknown): AiWorkspaceState {
  const base = emptyAiWorkspace();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<AiWorkspaceState>;
  return {
    ...base,
    ...o,
    version: 2,
    protocol: { ...base.protocol, ...(typeof o.protocol === "object" && o.protocol ? o.protocol : {}) },
    messages: Array.isArray(o.messages) ? o.messages : base.messages,
    context_notes: typeof o.context_notes === "string" ? o.context_notes : base.context_notes,
    context_attachments: Array.isArray(o.context_attachments)
      ? o.context_attachments.filter(
          (a): a is ContextAttachment =>
            !!a &&
            typeof a === "object" &&
            typeof (a as ContextAttachment).id === "string" &&
            typeof (a as ContextAttachment).text === "string" &&
            typeof (a as ContextAttachment).name === "string",
        )
      : base.context_attachments,
    consent_markdown:
      o.consent_markdown === null || typeof o.consent_markdown === "string"
        ? o.consent_markdown
        : base.consent_markdown,
    consent_missing: Array.isArray(o.consent_missing) ? o.consent_missing : base.consent_missing,
    compliance_flags: Array.isArray(o.compliance_flags) ? o.compliance_flags : base.compliance_flags,
    phase: o.phase ?? base.phase,
    predicted_category: o.predicted_category ?? base.predicted_category,
  };
}

export const PROTOCOL_SECTION_LABELS: Record<ProtocolSectionKey, string> = {
  background_rationale: "Background & rationale",
  study_design: "Study design",
  participants: "Participants",
  recruitment: "Recruitment",
  procedures: "Procedures",
  risks_benefits: "Risks & benefits",
  confidentiality: "Confidentiality",
  consent_process: "Consent process",
};

export function protocolHasReviewContent(protocol: ProtocolDraft): boolean {
  return PROTOCOL_SECTION_KEYS.some((k) => (protocol[k] ?? "").trim().length > 0);
}

/** Single markdown document for upload-flow AI review (section notes, not a reformatted protocol). */
export function buildProtocolReviewMarkdown(protocol: ProtocolDraft): string {
  const parts: string[] = [];
  for (const k of PROTOCOL_SECTION_KEYS) {
    const v = (protocol[k] ?? "").trim();
    if (v) {
      parts.push(`### ${PROTOCOL_SECTION_LABELS[k]}\n\n${v}`);
    }
  }
  return parts.join("\n\n");
}
