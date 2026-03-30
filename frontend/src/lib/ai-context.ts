/** Free-text + uploads passed to Gemini alongside the structured protocol. */

import type { AiWorkspaceState } from "@/lib/ai-proposal-types";

export function supplementaryFromWorkspace(ws: AiWorkspaceState): SupplementaryContextPayload {
  return {
    notes: ws.context_notes,
    attachments: ws.context_attachments.map((a) => ({ name: a.name, text: a.text })),
  };
}

export type SupplementaryContextPayload = {
  notes: string;
  attachments: { name: string; text: string }[];
};

const PER_FILE_MAX = 48_000;
const TOTAL_MAX = 160_000;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n…[truncated for model context]`;
}

/** Builds a markdown block appended to prompts. */
export function formatSupplementaryContextForModel(payload: SupplementaryContextPayload): string {
  const notes = String(payload.notes ?? "").trim();
  const rawAttachments = Array.isArray(payload.attachments) ? payload.attachments : [];

  const parts: string[] = [];
  if (notes) {
    parts.push(`### Researcher notes\n${truncate(notes, PER_FILE_MAX)}`);
  }

  let used = parts.join("\n\n").length;
  for (const a of rawAttachments) {
    const name = String(a.name || "attachment").slice(0, 240);
    const body = truncate(String(a.text ?? "").trim(), PER_FILE_MAX);
    if (!body) continue;
    const block = `### Uploaded file: ${name}\n${body}`;
    if (used + block.length > TOTAL_MAX) {
      parts.push(
        "### Further attachments omitted\nAdditional uploaded files were not included because the context limit was reached. Remove or shorten materials and try again.",
      );
      break;
    }
    parts.push(block);
    used += block.length + 2;
  }

  if (parts.length === 0) return "";

  return `\n\n---\n## Supplementary materials\nUse this alongside the conversation and protocol. If materials conflict with chat answers, ask a brief clarifying question or note the tension in the protocol draft.\n\n${parts.join("\n\n")}\n`;
}
