import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shown on full-page tour demo routes — not real data. */
export function TourDemoBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full items-start gap-3.5 rounded-xl border border-sky-500/25 bg-sky-500/5 px-5 py-4 text-sm text-foreground",
        className,
      )}
      role="status"
    >
      <Sparkles className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium leading-snug text-foreground">Guided tour preview</p>
        <p className="text-muted-foreground leading-relaxed">
          This is a sample screen with placeholder data. Use Next and Back in the tour panel to continue.
        </p>
      </div>
    </div>
  );
}
