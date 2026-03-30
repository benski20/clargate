import { AlertTriangle, Clock, Mail } from "lucide-react";

const problems = [
  {
    icon: Mail,
    title: "Fragmented Communication",
    description:
      "Submissions scattered across email threads, PDFs, and spreadsheets. No single source of truth for proposal status.",
  },
  {
    icon: Clock,
    title: "Weeks of Delays",
    description:
      "IRB admins spend 10+ hours per week coaching researchers on rewrites, chasing documents, and drafting revision letters manually.",
  },
  {
    icon: AlertTriangle,
    title: "Inconsistent Reviews",
    description:
      "Different reviewers interpret guidelines differently. No standardized process leads to unpredictable outcomes for researchers.",
  },
];

export function ProblemSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            The Problem
          </p>
          <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            IRB review is broken
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Most institutions rely on tools built decades ago, patched together
            with email and spreadsheets.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {problems.map((item) => (
            <div
              key={item.title}
              className="group cursor-pointer rounded-2xl border border-border bg-card p-8 transition-all duration-200 hover:border-primary/30 hover:shadow-lg"
            >
              <div className="mb-5 inline-flex rounded-xl bg-destructive/10 p-3">
                <item.icon className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="mb-3 font-[var(--font-heading)] text-lg font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
