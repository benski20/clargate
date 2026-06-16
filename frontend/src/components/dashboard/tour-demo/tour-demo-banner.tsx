import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export function TourDemoBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-border/40 bg-muted/30 px-4 py-3 text-sm",
        className,
      )}
      role="status"
    >
      <Eye className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground/80">Preview mode</span>
        {" — "}
        Sample data shown for demonstration. Use the tour panel to navigate.
      </p>
    </div>
  );
}
