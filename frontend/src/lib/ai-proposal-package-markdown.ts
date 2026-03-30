import {
  PROTOCOL_SECTION_KEYS,
  PROTOCOL_SECTION_LABELS,
  type AiWorkspaceState,
} from "@/lib/ai-proposal-types";

function section(title: string, body: string): string {
  const t = body.trim();
  if (!t) return `## ${title}\n\n_(Not provided.)_\n\n`;
  return `## ${title}\n\n${t}\n\n`;
}

/** Human-readable full package for review, download, and S3 upload. */
export function buildProposalPackageMarkdown(ws: AiWorkspaceState, studyTitle: string): string {
  const title = studyTitle.trim() || "Draft study";
  const lines: string[] = [
    `# ${title}`,
    "",
    `**Generated:** ${new Date().toISOString()}`,
    "",
  ];

  if (ws.predicted_category) {
    lines.push(`**Predicted review category (informational):** ${ws.predicted_category.replace(/_/g, " ")}`, "");
  }

  lines.push("---", "", "# Protocol (structured draft)", "");

  for (const key of PROTOCOL_SECTION_KEYS) {
    lines.push(section(PROTOCOL_SECTION_LABELS[key], ws.protocol[key] ?? ""));
  }

  if (ws.context_notes.trim()) {
    lines.push("---", "", "# Workspace notes (researcher context)", "", ws.context_notes.trim(), "");
  }

  if (ws.context_attachments.length > 0) {
    lines.push("---", "", "# Context files (names; text used in AI)", "");
    for (const a of ws.context_attachments) {
      lines.push(`- **${a.name}** (${a.text.length.toLocaleString()} characters for model context)`, "");
    }
  }

  if (ws.consent_markdown?.trim()) {
    lines.push("---", "", "# Consent draft", "", ws.consent_markdown.trim(), "");
    if (ws.consent_missing.length > 0) {
      lines.push("", "### Elements to strengthen", "");
      for (const m of ws.consent_missing) {
        lines.push(`- ${m}`);
      }
      lines.push("");
    }
  }

  if (ws.compliance_flags.length > 0) {
    lines.push("---", "", "# Compliance review notes", "");
    for (const f of ws.compliance_flags) {
      lines.push(`- **${f.severity}** (${f.section_key}): ${f.message}`);
      if (f.cfr_reference) lines.push(`  - Ref: ${f.cfr_reference}`);
      lines.push("");
    }
  }

  lines.push("---", "", "_End of package_");
  return lines.join("\n");
}

export function proposalPackageFilename(proposalId: string): string {
  const short = proposalId.replace(/-/g, "").slice(0, 8);
  const d = new Date().toISOString().slice(0, 10);
  return `proposal-package-${short}-${d}.md`;
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
