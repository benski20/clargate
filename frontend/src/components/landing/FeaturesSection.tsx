"use client";

import { Brain, MessageSquare, ShieldCheck, FileText, Users, BarChart3 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { RevealStagger, RevealItem } from "@/components/motion";

const features = [
  {
    icon: Brain,
    title: "AI-assisted review",
    description:
      "Summaries, risk signals, and revision drafts — less manual reading, more defensible decisions.",
  },
  {
    icon: MessageSquare,
    title: "Unified threads",
    description:
      "Per-proposal conversations with context and attachments. Fewer dropped handoffs.",
  },
  {
    icon: ShieldCheck,
    title: "Governance by design",
    description:
      "Role-based access, MFA-ready flows, and an append-only audit trail you can stand behind.",
  },
  {
    icon: FileText,
    title: "Guided submissions",
    description:
      "Step-by-step intake with an assistant that helps PIs get it right the first time.",
  },
  {
    icon: Users,
    title: "Role-aware surfaces",
    description:
      "PIs, admins, and reviewers each get a focused workspace — no noise, no guesswork.",
  },
  {
    icon: BarChart3,
    title: "Operational clarity",
    description:
      "Pipeline visibility, deadlines, and renewals in one place — no spreadsheet reconciliation.",
  },
];

export function FeaturesSection() {
  const reduced = useReducedMotion();

  return (
    <section id="features" className="border-y border-border/60 bg-muted/30 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Platform"
          title="Precision tooling for the full IRB lifecycle"
          description="Everything your institution needs to move from submission to approval — in one cohesive system."
        />

        <RevealStagger className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {features.map((item) => (
            <RevealItem key={item.title}>
              <motion.div
                whileHover={
                  reduced
                    ? undefined
                    : {
                        y: -3,
                        transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                      }
                }
                className="group h-full cursor-pointer rounded-2xl border border-border/70 bg-card/90 p-7 shadow-sm backdrop-blur-sm transition-shadow duration-200 hover:border-primary/20 hover:shadow-md"
              >
                <div className="mb-5 inline-flex rounded-xl bg-primary/[0.08] p-3 transition-colors duration-200 group-hover:bg-primary/[0.12]">
                  <item.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                </div>
                <h3 className="mb-2 font-[var(--font-heading)] text-base font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </motion.div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
