import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Inline callout used on My proposals during the guided tour. */
export function DraftPrivacyCallout({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3.5 text-sm",
        className,
      )}
      role="status"
    >
      <Lock className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
      <p className="text-muted-foreground leading-relaxed">
        Drafts are visible only to you until you press{" "}
        <span className="font-medium text-foreground">Submit to IRB</span>. IRB staff and reviewers cannot access
        draft packages — work saves automatically as you go.
      </p>
    </div>
  );
}
