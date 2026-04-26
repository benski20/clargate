/** Stored on submit in `proposals.form_data.submission_snapshot` (markdown + S3 package files). */
export type SubmissionSnapshot = {
  markdown: string;
  file_name: string;
  submitted_at: string;
  /** S3-backed `proposal_documents` row — same stem as `file_name` but `.docx`. */
  docx_file_name?: string;
  /** S3-backed `proposal_documents` row — same stem as `file_name` but `.pdf`. */
  pdf_file_name?: string;
};

export function getSubmissionSnapshot(
  formData: Record<string, unknown> | null | undefined,
): SubmissionSnapshot | null {
  if (!formData || typeof formData !== "object") return null;
  const raw = formData.submission_snapshot;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const markdown = o.markdown;
  if (typeof markdown !== "string" || !markdown.trim()) return null;
  const file_name =
    typeof o.file_name === "string" && o.file_name.trim() ? o.file_name : "proposal-package.md";
  const submitted_at =
    typeof o.submitted_at === "string" && o.submitted_at.trim()
      ? o.submitted_at
      : new Date().toISOString();
  const docx_file_name =
    typeof o.docx_file_name === "string" && o.docx_file_name.trim() ? o.docx_file_name.trim() : undefined;
  const pdf_file_name =
    typeof o.pdf_file_name === "string" && o.pdf_file_name.trim() ? o.pdf_file_name.trim() : undefined;
  return { markdown, file_name, submitted_at, docx_file_name, pdf_file_name };
}
