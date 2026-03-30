import type { InstitutionAiGuidanceCategory } from "@/lib/types";

const CATEGORY_HEADINGS: Record<InstitutionAiGuidanceCategory, string> = {
  example_proposal: "Example proposal(s)",
  rules: "Proposal rules",
  guidelines: "Guidelines",
  institutional: "Institutional specifics",
};

const PER_ITEM_MAX = 24_000;
const TOTAL_MAX = 72_000;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n…[truncated for model context]`;
}

/** Markdown block appended to AI system instructions (empty if no rows). */
export function formatInstitutionGuidanceForModel(
  rows: {
    category: InstitutionAiGuidanceCategory;
    title: string | null;
    content_type: "text" | "file";
    body_text: string | null;
    file_name: string | null;
    extracted_text: string | null;
  }[],
): string {
  if (!rows.length) return "";

  const parts: string[] = [];
  let used = 0;

  for (const row of rows) {
    const heading = CATEGORY_HEADINGS[row.category];
    const label = row.title?.trim() || (row.content_type === "file" ? row.file_name || "Uploaded file" : "Note");
    let body = "";
    if (row.content_type === "text") {
      body = String(row.body_text ?? "").trim();
    } else {
      body = String(row.extracted_text ?? "").trim();
      if (!body) body = "(No text extracted from this file; replace with PDF/text or re-upload.)";
    }
    if (!body) continue;

    body = truncate(body, PER_ITEM_MAX);
    const block = `#### ${heading} — ${label}\n${body}`;
    if (used + block.length > TOTAL_MAX) {
      parts.push(
        "\n_Further institutional materials were omitted to stay within the model context limit._",
      );
      break;
    }
    parts.push(block);
    used += block.length + 2;
  }

  if (parts.length === 0) return "";

  return `\n\n---\n## Institutional configuration (mandatory)\nApply these rules, examples, and local expectations when drafting, reviewing consent, and flagging compliance. If a PI-specific detail conflicts with an institutional rule below, prefer the institutional rule and note the tension in the protocol or flags.\n\n${parts.join("\n\n")}\n`;
}
