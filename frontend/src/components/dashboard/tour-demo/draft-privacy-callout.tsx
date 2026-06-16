import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export function DraftPrivacyCallout({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border/40 bg-muted/30 px-4 py-3.5 text-sm",
        className,
      )}
      role="status"
    >
      <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <p className="text-muted-foreground leading-relaxed">
        Drafts are visible only to you until you press{" "}
        <span className="font-medium text-foreground/80">Submit to IRB</span>. Staff and reviewers cannot access
        draft packages.
      </p>
    </div>
  );
}
