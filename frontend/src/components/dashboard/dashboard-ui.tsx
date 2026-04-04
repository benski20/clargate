import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

/** Soft elevated surface — sleek enterprise */
export const dashboardCardClass =
  "rounded-xl border border-border/60 bg-card shadow-sm transition-all duration-200 hover:shadow-md";

/** Filters / toolbars that sit above cards */
export const dashboardToolbarClass =
  "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between";

/** Clean enterprise inputs */
export const dashboardInputClass = "h-9 rounded-md border-border/60 bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Search field with a leading icon — avoids padding conflicts between `pl-*` and `px-3`
 * on plain `Input` + absolute icons.
 */
export function DashboardSearchInput({
  className,
  ...props
}: React.ComponentProps<typeof InputGroupInput>) {
  return (
    <InputGroup
      className={cn(
        "h-9 min-h-9 rounded-md border-border/60 bg-background shadow-sm transition-colors",
        "has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-ring"
      )}
    >
      <InputGroupAddon className="pl-3 text-muted-foreground [&>svg]:pointer-events-none">
        <Search className="size-4 shrink-0" aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        className={cn("h-9 min-h-0 text-sm placeholder:text-muted-foreground", className)}
        {...props}
      />
    </InputGroup>
  );
}

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 font-semibold text-2xl tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Given / first name(s): all words except the last (family name). Single word → unchanged. */
export function displayGivenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return parts.slice(0, -1).join(" ");
}

export function DashboardWelcome({
  name,
  subtitle,
  className,
}: {
  name: string;
  subtitle?: string;
  className?: string;
}) {
  const given = displayGivenName(name);
  return (
    <div className={cn("min-w-0", className)}>
      <p className="font-mono text-[0.65rem] font-normal uppercase tracking-[0.2em] text-muted-foreground">
        Workspace
      </p>
      <h1 className="mt-2 font-semibold text-3xl tracking-tight text-foreground md:text-4xl">
        Welcome, {given || "—"}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm text-muted-foreground md:text-base">{subtitle}</p>
      ) : null}
    </div>
  );
}
