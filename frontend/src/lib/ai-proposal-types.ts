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

const SECTION_KEYS_WITH_META = [...PROTOCOL_SECTION_KEYS, "consent", "general"] as const;

function isProtocolSectionKeyLike(v: unknown): v is ProtocolSectionKey | "consent" | "general" {
  return typeof v === "string" && (SECTION_KEYS_WITH_META as readonly string[]).includes(v);
}

/** Map persisted or model-shaped flags into {@link ComplianceFlag} (handles alternate field names). */
export function normalizeComplianceFlags(input: unknown): ComplianceFlag[] {
  if (!Array.isArray(input)) return [];
  const out: ComplianceFlag[] = [];
  for (let idx = 0; idx < input.length; idx++) {
    const raw = input[idx];
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const id =
      typeof o.id === "string" && o.id.trim()
        ? o.id
        : `flag_${idx}_${Math.random().toString(36).slice(2, 10)}`;
    const message = typeof o.message === "string" ? o.message : "";
    const severity: ComplianceFlag["severity"] =
      o.severity === "error" || o.severity === "warning" || o.severity === "info" ? o.severity : "info";
    const section_key: ComplianceFlag["section_key"] = isProtocolSectionKeyLike(o.section_key)
      ? o.section_key
      : "general";
    const cfr_reference =
      typeof o.cfr_reference === "string" && o.cfr_reference.trim()
        ? o.cfr_reference.trim()
        : typeof o.citation === "string" && o.citation.trim()
          ? o.citation.trim()
          : typeof o.regulatory_reference === "string" && o.regulatory_reference.trim()
            ? o.regulatory_reference.trim()
            : undefined;
    const actionable =
      typeof o.actionable === "string" && o.actionable.trim()
        ? o.actionable.trim()
        : typeof o.suggested_fix === "string" && o.suggested_fix.trim()
          ? o.suggested_fix.trim()
          : typeof o.suggestion === "string" && o.suggestion.trim()
            ? o.suggestion.trim()
            : typeof o.remediation === "string" && o.remediation.trim()
              ? o.remediation.trim()
              : undefined;
    const flag: ComplianceFlag = { id, severity, message, section_key };
    if (cfr_reference) flag.cfr_reference = cfr_reference;
    if (actionable) flag.actionable = actionable;
    out.push(flag);
  }
  return out;
}

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

export type ExtraMaterial = {
  id: string;
  name: string;
  mimeType: string;
  /** Optional user-provided caption/description shown to reviewers. */
  description: string;
  /** Link back to a context attachment when re-using an uploaded file. */
  source_context_attachment_id?: string;
  /** Backing proposal_documents row (filled in on upload/persist). */
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
  /** Extra documents to submit alongside the consent + proposal package (e.g., recruitment scripts, surveys). */
  extra_materials: ExtraMaterial[];
  consent_markdown: string | null;
  /** User opted out of AI consent draft generation during upload AI review; consent step is skipped in the flow. */
  consent_generation_declined?: boolean;
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
    extra_materials: [],
    consent_markdown: null,
    consent_generation_declined: false,
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
    extra_materials: Array.isArray((o as any).extra_materials)
      ? ((o as any).extra_materials as unknown[]).filter(
          (m): m is ExtraMaterial =>
            !!m &&
            typeof m === "object" &&
            typeof (m as ExtraMaterial).id === "string" &&
            typeof (m as ExtraMaterial).name === "string" &&
            typeof (m as ExtraMaterial).mimeType === "string" &&
            typeof (m as ExtraMaterial).description === "string",
        )
      : base.extra_materials,
    consent_markdown:
      o.consent_markdown === null || typeof o.consent_markdown === "string"
        ? o.consent_markdown
        : base.consent_markdown,
    consent_missing: Array.isArray(o.consent_missing) ? o.consent_missing : base.consent_missing,
    consent_generation_declined:
      typeof o.consent_generation_declined === "boolean"
        ? o.consent_generation_declined
        : base.consent_generation_declined,
    compliance_flags: Array.isArray(o.compliance_flags)
      ? normalizeComplianceFlags(o.compliance_flags)
      : base.compliance_flags,
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
