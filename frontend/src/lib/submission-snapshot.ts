/** Stored on submit in `proposals.form_data.submission_snapshot` (no S3 / Edge Function). */
export type SubmissionSnapshot = {
  markdown: string;
  file_name: string;
  submitted_at: string;
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
  return { markdown, file_name, submitted_at };
}
