import { TourDemoBanner } from "@/components/dashboard/tour-demo/tour-demo-banner";
import { cn } from "@/lib/utils";

/** Read-only wrapper for guided-tour demo routes using real screens. */
export function TourDemoShell({
  children,
  layout = "default",
}: {
  children: React.ReactNode;
  /** fullBleed: child uses horizontal full-bleed (e.g. AI intake); keep banner above without overlap. */
  layout?: "default" | "fullBleed";
}) {
  return (
    <div className={cn("flex w-full flex-col", layout === "fullBleed" ? "gap-5" : "gap-6")}>
      <TourDemoBanner className="shrink-0" />
      <div
        className={cn(
          "min-h-0 pointer-events-none select-none [&_a]:pointer-events-none [&_button]:cursor-default [&_input]:pointer-events-none [&_select]:pointer-events-none [&_textarea]:pointer-events-none",
          layout === "fullBleed" && "min-w-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}
