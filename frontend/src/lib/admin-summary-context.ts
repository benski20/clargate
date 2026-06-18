import {
  normalizeAiWorkspace,
  normalizeComplianceFlags,
  PROTOCOL_SECTION_KEYS,
  type ProtocolSectionKey,
} from "@/lib/ai-proposal-types";
import { getProposalReviewTypeLabel } from "@/lib/review-types";

const CONSENT_MAX = 6_000;
const NOTES_MAX = 4_000;
const PROTOCOL_SECTION_MAX = 10_000;
const CHAT_TURN_MAX = 1_200;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n…[truncated for model context]`;
}

function perFilePreviewLimit(fileCount: number): number {
  if (fileCount >= 15) return 500;
  if (fileCount >= 10) return 1_000;
  if (fileCount >= 6) return 2_000;
  return 5_000;
}

function totalAttachmentBudget(fileCount: number): number {
  if (fileCount >= 15) return 40_000;
  if (fileCount >= 10) return 70_000;
  return 140_000;
}

function omitKeys(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.includes(k)) out[k] = v;
  }
  return out;
}

/** Compact proposal payload for admin AI summary — avoids dumping raw attachment corpora. */
export function buildAdminSummaryContext(
  title: string,
  formData: Record<string, unknown> | null,
  options?: { documentFileNames?: string[]; reviewType?: string | null },
): string {
  const fd = formData ?? {};
  const ws = normalizeAiWorkspace(fd.ai_workspace);

  const attachments = ws.context_attachments.map((a) => ({
    id: a.id,
    name: a.name,
    mimeType: a.mimeType,
    has_stored_document: Boolean(a.document_id),
  }));

  const extraMaterials = ws.extra_materials.map((m) => ({
    name: m.name,
    description: m.description?.trim() || undefined,
    source: m.source_context_attachment_id ? "context_reuse" : "extra_upload",
    has_stored_document: Boolean(m.document_id),
  }));

  const fileCount = Math.max(
    attachments.length,
    extraMaterials.length,
    options?.documentFileNames?.length ?? 0,
  );
  const perFileMax = perFilePreviewLimit(fileCount);
  const totalBudget = totalAttachmentBudget(fileCount);

  const materialPreviews: Array<Record<string, unknown>> = [];
  let usedChars = 0;
  let omittedCount = 0;

  for (const a of ws.context_attachments) {
    const raw = (a.text ?? "").trim();
    if (!raw) {
      materialPreviews.push({ name: a.name, preview: "(no extracted text on file record)" });
      continue;
    }
    if (usedChars >= totalBudget) {
      omittedCount += 1;
      continue;
    }
    const room = Math.min(perFileMax, totalBudget - usedChars);
    const preview = truncate(raw, room);
    usedChars += preview.length;
    materialPreviews.push({
      name: a.name,
      mimeType: a.mimeType,
      preview,
      preview_truncated: preview.length < raw.length,
    });
  }

  const protocolReview: Partial<Record<ProtocolSectionKey, string>> = {};
  for (const key of PROTOCOL_SECTION_KEYS) {
    const section = (ws.protocol[key] ?? "").trim();
    if (section) protocolReview[key] = truncate(section, PROTOCOL_SECTION_MAX);
  }

  const chatExcerpt = ws.messages
    .slice(-6)
    .map((m) => ({
      role: m.role,
      content: truncate(m.content, CHAT_TURN_MAX),
    }))
    .filter((m) => m.content.length > 0);

  const structuredForm = omitKeys(fd, ["ai_workspace", "submission_snapshot"]);

  const payload = {
    title,
    submitted_review_category: getProposalReviewTypeLabel({
      review_type: options?.reviewType,
      form_data: fd,
    }),
    entry_mode: fd.entry_mode ?? undefined,
    structured_form: structuredForm,
    ai_review: {
      predicted_category: ws.predicted_category,
      protocol_review_sections: protocolReview,
      compliance_flags: normalizeComplianceFlags(ws.compliance_flags).map((f) => ({
        severity: f.severity,
        section_key: f.section_key,
        message: f.message,
        cfr_reference: f.cfr_reference,
        actionable: f.actionable,
      })),
      consent_excerpt: ws.consent_markdown ? truncate(ws.consent_markdown, CONSENT_MAX) : undefined,
      researcher_notes: ws.context_notes.trim() ? truncate(ws.context_notes, NOTES_MAX) : undefined,
      chat_excerpt: chatExcerpt.length > 0 ? chatExcerpt : undefined,
    },
    materials: {
      context_attachment_count: attachments.length,
      extra_material_count: extraMaterials.length,
      proposal_document_count: options?.documentFileNames?.length ?? 0,
      attachment_index: attachments,
      extra_materials: extraMaterials,
      stored_document_names: options?.documentFileNames,
      text_previews: materialPreviews,
      previews_omitted_count: omittedCount,
    },
    context_management: {
      attachment_previews_truncated: materialPreviews.some((p) => p.preview_truncated) || omittedCount > 0,
      previews_omitted_count: omittedCount,
      guidance:
        fileCount >= 6
          ? "Many files uploaded — rely primarily on protocol_review_sections and compliance_flags; attachment previews are shortened excerpts only."
          : "Use protocol_review_sections, compliance_flags, and attachment previews together.",
    },
  };

  return JSON.stringify(payload, null, 2);
}
