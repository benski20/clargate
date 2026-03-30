"use client";

import { FileUp, Search, CheckCircle2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { Reveal, RevealStagger, RevealItem } from "@/components/motion";

const steps = [
  {
    icon: FileUp,
    step: "01",
    title: "Submit",
    description:
      "Investigators complete guided intake with AI help — documents and answers in one place.",
  },
  {
    icon: Search,
    step: "02",
    title: "Review",
    description:
      "Admins triage with summaries, assign reviewers, and draft revision letters with assistance.",
  },
  {
    icon: CheckCircle2,
    step: "03",
    title: "Decide",
    description:
      "Structured evaluations, clear decisions, and renewal reminders — without the email chase.",
  },
];

export function HowItWorks() {
  const reduced = useReducedMotion();

  return (
    <section id="how-it-works" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Workflow"
          title="From submission to decision in three calm steps"
        />

        <RevealStagger className="relative mt-20 grid gap-14 md:grid-cols-3 md:gap-8">
          {steps.map((item) => (
            <RevealItem key={item.step}>
              <div className="relative text-center md:text-left">
                <motion.div
                  className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-border/80 bg-card shadow-sm md:mx-0"
                  whileHover={
                    reduced
                      ? undefined
                      : { scale: 1.02, transition: { duration: 0.2 } }
                  }
                >
                  <item.icon className="h-9 w-9 text-primary" strokeWidth={1.5} />
                </motion.div>
                <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary">
                  Step {item.step}
                </p>
                <h3 className="mb-3 font-[var(--font-heading)] text-xl font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">
                  {item.description}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>

        <Reveal className="mx-auto mt-16 max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">
            Every step is logged — so compliance and audit teams can answer “who did what, when”
            without digging through inboxes.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
