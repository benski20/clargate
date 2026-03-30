import { Brain, MessageSquare, ShieldCheck, FileText, Users, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Review",
    description:
      "Auto-generated proposal summaries, risk assessments, and revision letter drafts. Save hours of manual work per submission.",
  },
  {
    icon: MessageSquare,
    title: "Unified Messaging",
    description:
      "All communication in one place. Per-proposal threads, file attachments, and automatic reminders so nothing falls through the cracks.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Built-In",
    description:
      "Tamper-evident audit trail, role-based access, MFA enforcement, and US data residency. Architected toward SOC 2 Type II.",
  },
  {
    icon: FileText,
    title: "Guided Submissions",
    description:
      "Multi-step forms with an AI assistant that helps PIs complete submissions correctly the first time, reducing revision cycles.",
  },
  {
    icon: Users,
    title: "Role-Based Dashboards",
    description:
      "Purpose-built views for PIs, administrators, and reviewers. Everyone sees exactly what they need — nothing more, nothing less.",
  },
  {
    icon: BarChart3,
    title: "Full Visibility",
    description:
      "Track every proposal from submission to approval. Status pipeline, deadline tracking, and renewal reminders in one view.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-secondary/50 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Features
          </p>
          <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need for IRB review
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            One platform to submit, review, communicate, and approve — powered
            by AI.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => (
            <div
              key={item.title}
              className="group cursor-pointer rounded-2xl border border-white/20 bg-white/80 p-8 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-lg"
            >
              <div className="mb-5 inline-flex rounded-xl bg-primary/10 p-3">
                <item.icon className="h-6 w-6 text-primary" />
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
