import { FileUp, Search, CheckCircle2 } from "lucide-react";

const steps = [
  {
    icon: FileUp,
    step: "01",
    title: "Submit",
    description:
      "PIs complete a guided multi-step form with AI assistance. Upload documents, answer questions, and submit — all in one place.",
  },
  {
    icon: Search,
    step: "02",
    title: "Review",
    description:
      "Admins triage with AI-generated summaries. Assign reviewers, track progress, and draft revision letters with AI assistance.",
  },
  {
    icon: CheckCircle2,
    step: "03",
    title: "Approve",
    description:
      "Reviewers submit structured evaluations. Admins issue decisions and generate approval letters with automatic renewal reminders.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            How It Works
          </p>
          <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From submission to approval in three steps
          </h2>
        </div>

        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {steps.map((item, i) => (
            <div key={item.step} className="relative text-center">
              {i < steps.length - 1 && (
                <div className="absolute top-12 left-[calc(50%+40px)] hidden h-0.5 w-[calc(100%-80px)] bg-gradient-to-r from-primary/30 to-primary/10 md:block" />
              )}
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10">
                <item.icon className="h-10 w-10 text-primary" />
              </div>
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
                Step {item.step}
              </div>
              <h3 className="mb-3 font-[var(--font-heading)] text-xl font-semibold text-foreground">
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
