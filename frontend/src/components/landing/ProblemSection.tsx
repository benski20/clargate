"use client";

import { AlertTriangle, Clock, Mail } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { Reveal, RevealStagger, RevealItem } from "@/components/motion";

const problems = [
  {
    icon: Mail,
    title: "Fragmented communication",
    description:
      "Submissions scattered across email, PDFs, and spreadsheets — no single source of truth for status.",
  },
  {
    icon: Clock,
    title: "Hidden delays",
    description:
      "Admins lose hours coaching rewrites, chasing documents, and drafting revision letters by hand.",
  },
  {
    icon: AlertTriangle,
    title: "Inconsistent reviews",
    description:
      "Guidelines interpreted differently across reviewers — unpredictable outcomes for investigators.",
  },
];

function ProblemCard({ item }: { item: (typeof problems)[0] }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      whileHover={
        reduced
          ? undefined
          : { y: -2, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }
      }
      className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-8 shadow-sm transition-shadow duration-200 hover:border-primary/20 hover:shadow-md"
    >
      <div className="mb-5 inline-flex rounded-xl border border-border/60 bg-muted/50 p-3 transition-colors duration-200 group-hover:border-primary/15 group-hover:bg-primary/[0.06]">
        <item.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
      </div>
      <h3 className="mb-3 font-[var(--font-heading)] text-lg font-semibold tracking-tight text-foreground">
        {item.title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">
        {item.description}
      </p>
    </motion.div>
  );
}

export function ProblemSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="The gap"
          title="Legacy IRB workflows weren’t built for today"
          description="Most teams still stitch together tools from another era — patched with email and spreadsheets."
        />

        <RevealStagger className="mt-20 grid gap-6 md:grid-cols-3 md:gap-8">
          {problems.map((item) => (
            <RevealItem key={item.title}>
              <ProblemCard item={item} />
            </RevealItem>
          ))}
        </RevealStagger>

        <Reveal className="mx-auto mt-16 max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">
            Clargate replaces that patchwork with one governed workspace — built for compliance and speed.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
