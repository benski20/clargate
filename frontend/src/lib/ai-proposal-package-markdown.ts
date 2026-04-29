import {
  PROTOCOL_SECTION_KEYS,
  PROTOCOL_SECTION_LABELS,
  type AiWorkspaceState,
} from "@/lib/ai-proposal-types";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** e.g. "April 5, 2026 at 3:45 PM" (locale-aware). */
function formatGeneratedTimestamp(d: Date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(d);
}

/** Stable, file-safe stem e.g. `apr-5-2026` (not locale-dependent for sorting consistency). */
function formatFilenameDateStem(d: Date = new Date()): string {
  return d
    .toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    .toLowerCase()
    .replace(/,\s*/g, "-")
    .replace(/\s+/g, "-");
}

function section(title: string, body: string): string {
  const t = sanitizeProtocolSection(body).trim();
  if (!t) return "";
  return `## ${title}\n\n${t}\n\n`;
}

function sanitizeProtocolSection(body: string): string {
  if (!body) return "";
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let dropMode = false;
  const stopHeadings = [/^\s*gaps?\s*\/\s*ambiguities\s*:/i, /^\s*suggested\s+revisions?\s*:/i];

  for (const line of lines) {
    const isStopHeading = stopHeadings.some((re) => re.test(line));
    if (isStopHeading) {
      dropMode = true;
      continue;
    }
    if (dropMode) {
      // Once callout blocks start, keep dropping until a blank line plus real prose later.
      // In practice these callouts are appended at the end of a section.
      if (!line.trim()) continue;
      if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) continue;
      continue;
    }
    out.push(line);
  }
  return out.join("\n").trim();
}

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "study"
  );
}

/** Human-readable full package for review, download, and S3 upload. */
export function buildProposalPackageMarkdown(
  ws: AiWorkspaceState,
  studyTitle: string,
  _opts?: { includeConsent?: boolean; includeCompliance?: boolean },
): string {
  const title = studyTitle.trim() || "Study Protocol";
  const lines: string[] = [
    `# ${title}`,
    "",
    `Prepared for IRB submission on ${formatGeneratedTimestamp()}.`,
    "",
  ];

  lines.push("## Final protocol", "");

  let includedSections = 0;
  for (const key of PROTOCOL_SECTION_KEYS) {
    const block = section(PROTOCOL_SECTION_LABELS[key], ws.protocol[key] ?? "");
    if (block) {
      lines.push(block);
      includedSections += 1;
    }
  }
  if (includedSections === 0) {
    lines.push("Protocol content will appear here once sections are completed.", "");
  }
  return lines.join("\n");
}

export function proposalPackageFilename(proposalId: string, studyTitle: string): string {
  const short = proposalId.replace(/-/g, "").slice(0, 8);
  const d = formatFilenameDateStem();
  const slug = slugifyTitle(studyTitle);
  return `irb-submission-${slug}-${d}-${short}.md`;
}

export function proposalPackagePdfFilename(proposalId: string, studyTitle: string): string {
  const short = proposalId.replace(/-/g, "").slice(0, 8);
  const d = formatFilenameDateStem();
  const slug = slugifyTitle(studyTitle);
  return `irb-submission-${slug}-${d}-${short}.pdf`;
}

/** Same date stem as {@link proposalPackageFilename}, `.docx` for Word. */
export function proposalPackageDocxFilename(proposalId: string, studyTitle: string): string {
  const short = proposalId.replace(/-/g, "").slice(0, 8);
  const d = formatFilenameDateStem();
  const slug = slugifyTitle(studyTitle);
  return `irb-submission-${slug}-${d}-${short}.docx`;
}

export function downloadProposalPackageMarkdown(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeMarkdownForPdf(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/^\s*#{1,6}\s+/gm, "") // strip heading hashes
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/_(.*?)_/g, "$1") // italics
    .replace(/^\s*-\s+/gm, "• ") // bullets
    .replace(/^\s*\d+\.\s+/gm, (m) => m) // keep numbered lists
    .trim();
}

function wrapLine(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= maxWidth) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    // very long word fallback
    if (measure(w) > maxWidth) {
      let chunk = "";
      for (const ch of w) {
        const test = chunk + ch;
        if (measure(test) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = test;
        }
      }
      cur = chunk;
    } else {
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function buildProposalPackagePdfBytes(markdown: string): Promise<Uint8Array> {
  const text = normalizeMarkdownForPdf(markdown);
  const pdf = await PDFDocument.create();

  const pageWidth = 612; // US Letter points (8.5in)
  const pageHeight = 792; // 11in
  const margin = 54;
  const fontSize = 11;
  const lineHeight = 15;

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const measure = (s: string) => font.widthOfTextAtSize(s, fontSize);
  const maxWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const paragraphs = text.split("\n");
  for (const p of paragraphs) {
    const isRule = /^-{3,}\s*$/.test(p);
    if (isRule) {
      y -= lineHeight;
      if (y < margin) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 1,
        color: rgb(0.82, 0.82, 0.82),
      });
      y -= lineHeight;
      continue;
    }

    const lines = wrapLine(p, maxWidth, measure);
    for (const line of lines) {
      if (y < margin) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.08, 0.08, 0.08) });
      y -= lineHeight;
    }
    // paragraph spacing
    y -= Math.round(lineHeight * 0.35);
  }

  const bytes = await pdf.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export async function downloadProposalPackagePdf(markdown: string, filename: string): Promise<void> {
  const bytes = await buildProposalPackagePdfBytes(markdown);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
