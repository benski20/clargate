import type { ReactNode } from "react";
import { InlineBulletText } from "@/components/proposals/InlineBulletText";
import {
  extractAiCallouts,
  hasInlineBullets,
  markdownToPlainText,
} from "@/lib/format-ai-review-text";

const SUGGESTED_LABEL_RE =
  /(?:^|\s)Suggested\s+(?:revisions?(?:\s*\/\s*clarifications?)?|clarifications?)\s*:\s*/i;

/** Render stored form_data string values with structured bullets and AI callout blocks. */
export function FormJsonStringValue({
  value,
  mutedIntro = false,
}: {
  value: string;
  mutedIntro?: boolean;
}): ReactNode {
  const plain = markdownToPlainText(value);
  const callouts = extractAiCallouts(plain);

  if (callouts) {
    return (
      <div className="space-y-2">
        {callouts.body ? (
          <InlineBulletText
            text={callouts.body}
            introClassName={mutedIntro ? "text-muted-foreground" : undefined}
          />
        ) : null}
        {callouts.gaps ? (
          <div className="rounded-md bg-muted/25 px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Gaps / ambiguities
            </div>
            <div className="mt-1">
              <InlineBulletText text={callouts.gaps} />
            </div>
          </div>
        ) : null}
        {callouts.suggested ? (
          <div className="rounded-md bg-muted/25 px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested revisions
            </div>
            <div className="mt-1">
              <InlineBulletText text={callouts.suggested} />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const suggestedMatch = plain.match(SUGGESTED_LABEL_RE);
  if (suggestedMatch?.index != null) {
    const before = plain.slice(0, suggestedMatch.index).trim();
    const after = plain.slice(suggestedMatch.index).replace(SUGGESTED_LABEL_RE, "").trim();
    return (
      <div className="space-y-2">
        {before ? (
          <InlineBulletText
            text={before}
            introClassName={mutedIntro ? "text-muted-foreground" : undefined}
          />
        ) : null}
        {after ? (
          <div className="rounded-md bg-muted/25 px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested revisions
            </div>
            <div className="mt-1">
              <InlineBulletText text={after} />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (hasInlineBullets(plain)) {
    return (
      <InlineBulletText text={plain} introClassName={mutedIntro ? "text-muted-foreground" : undefined} />
    );
  }

  return plain;
}
