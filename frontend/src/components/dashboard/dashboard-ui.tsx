import { cn } from "@/lib/utils";

/** Soft elevated surface — editorial warm chrome */
export const dashboardCardClass =
  "rounded-3xl border border-border/90 bg-card shadow-[0_2px_8px_-2px_rgba(10,10,10,0.06),0_1px_2px_-1px_rgba(10,10,10,0.04)]";

/** Filters / toolbars that sit above cards */
export const dashboardToolbarClass =
  "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between";

/** Rounded inputs matching dashboard chrome */
export const dashboardInputClass = "h-11 rounded-2xl border-border/80 bg-background";

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
        <h1 className="mt-1 font-[var(--font-heading)] text-2xl font-medium tracking-tight text-foreground md:text-3xl">
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

export function DashboardWelcome({
  name,
  subtitle,
  className,
}: {
  name: string;
  subtitle?: string;
  className?: string;
}) {
  const first = name.split(/\s+/)[0] || name;
  return (
    <div className={cn("min-w-0", className)}>
      <p className="font-mono text-[0.65rem] font-normal uppercase tracking-[0.2em] text-muted-foreground">
        Workspace
      </p>
      <h1 className="mt-3 font-[var(--font-heading)] text-3xl font-medium tracking-tight text-foreground md:text-4xl">
        Welcome, {first}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm text-muted-foreground md:text-base">{subtitle}</p>
      ) : null}
    </div>
  );
}
