const INLINE_BULLET_RE = /\s*[•\u2022]\s*/;

export function hasInlineBullets(text: string): boolean {
  return INLINE_BULLET_RE.test(text);
}

/** Split AI plain-text that uses inline • characters into intro + list items. */
export function splitInlineBulletItems(text: string): { intro: string; items: string[] } {
  const trimmed = (text ?? "").trim();
  if (!hasInlineBullets(trimmed)) {
    return { intro: trimmed, items: [] };
  }

  const segments = trimmed
    .split(INLINE_BULLET_RE)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    return { intro: trimmed, items: [] };
  }

  return { intro: segments[0] ?? "", items: segments.slice(1) };
}

export function markdownToPlainText(input: string): string {
  if (!input) return "";
  return input
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*\d+\.\s+/gm, "• ")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
    .trim();
}

const GAPS_LABEL_RE =
  /(?:^|\s)(?:Gaps(?:\/Ambiguities)?(?:\s+identified[^:]*)?|Ambiguities(?:\s+identified[^:]*)?)\s*:\s*/i;
const SUGGESTED_LABEL_RE =
  /(?:^|\s)Suggested\s+(?:revisions?(?:\s*\/\s*clarifications?)?|clarifications?)\s*:\s*/i;

export function extractAiCallouts(text: string): { body: string; gaps?: string; suggested?: string } | null {
  const t = (text ?? "").trim();
  if (!t) return null;

  if (!GAPS_LABEL_RE.test(t) && !SUGGESTED_LABEL_RE.test(t)) return null;

  let body = t;
  let gaps: string | undefined;
  let suggested: string | undefined;

  const suggestedMatch = body.match(SUGGESTED_LABEL_RE);
  if (suggestedMatch?.index != null) {
    const idx = suggestedMatch.index;
    const before = body.slice(0, idx).trim();
    const after = body.slice(idx).replace(SUGGESTED_LABEL_RE, "").trim();
    body = before;
    suggested = after || undefined;
  }

  const gapsMatch = body.match(GAPS_LABEL_RE);
  if (gapsMatch?.index != null) {
    const idx = gapsMatch.index;
    const before = body.slice(0, idx).trim();
    const after = body.slice(idx).replace(GAPS_LABEL_RE, "").trim();
    body = before;
    gaps = after || undefined;
  }

  if (gaps && SUGGESTED_LABEL_RE.test(gaps) && !suggested) {
    const parts = gaps.split(SUGGESTED_LABEL_RE);
    gaps = parts[0]?.trim() || undefined;
    suggested = parts.slice(1).join(" ").trim() || undefined;
  }

  return { body, gaps, suggested };
}

/** Convert inline • bullets (common in AI plain-text output) into markdown list lines. */
export function normalizeInlineBulletsForMarkdown(text: string): string {
  if (!hasInlineBullets(text)) return text;

  return text
    .split("\n")
    .map((line) => {
      if (!hasInlineBullets(line)) return line;

      const { intro, items } = splitInlineBulletItems(line);
      if (items.length === 0) return line;

      const blocks: string[] = [];
      if (intro) blocks.push(intro);
      blocks.push(...items.map((item) => `- ${item}`));
      return blocks.join("\n");
    })
    .join("\n");
}
