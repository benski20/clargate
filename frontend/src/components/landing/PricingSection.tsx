"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { Reveal, RevealStagger, RevealItem } from "@/components/motion";

const tiers = [
  {
    name: "Starter",
    price: "$499",
    period: "/month",
    description: "For smaller institutions adopting modern IRB tooling.",
    features: [
      "Up to 50 submissions/year",
      "3 admin seats",
      "AI proposal summaries",
      "Unified messaging",
      "Document storage",
      "Email notifications",
    ],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "$999",
    period: "/month",
    description: "For mid-size institutions needing full workflow automation.",
    features: [
      "Unlimited submissions",
      "Unlimited admin & reviewer seats",
      "AI revision letter drafting",
      "PI assistant",
      "SSO / SAML integration",
      "Audit log & compliance reporting",
      "Priority support",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large research organizations with advanced requirements.",
    features: [
      "Everything in Professional",
      "Dedicated success manager",
      "Custom SSO configuration",
      "Advanced analytics",
      "Data migration assistance",
      "BAA & custom contracts",
      "On-premise option available",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

export function PricingSection() {
  const reduced = useReducedMotion();

  return (
    <section id="pricing" className="border-y border-border/60 bg-muted/25 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple institution-wide pricing"
          description="One subscription covers your organization — predictable cost, no per-seat surprises."
        />

        <RevealStagger className="mt-20 grid gap-6 lg:grid-cols-3 lg:gap-5">
          {tiers.map((tier) => (
            <RevealItem key={tier.name}>
              <motion.div
                whileHover={
                  reduced
                    ? undefined
                    : { y: -2, transition: { duration: 0.2 } }
                }
                className={`relative flex h-full flex-col rounded-2xl border p-8 transition-shadow duration-200 ${
                  tier.highlighted
                    ? "border-primary/40 bg-card shadow-lg shadow-primary/10 ring-2 ring-primary/15"
                    : "border-border/80 bg-card/90 shadow-sm hover:border-primary/20 hover:shadow-md"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-primary-foreground">
                    Recommended
                  </div>
                )}
                <h3 className="font-[var(--font-heading)] text-lg font-semibold text-foreground">
                  {tier.name}
                </h3>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-foreground">
                    {tier.price}
                  </span>
                  <span className="text-sm text-muted-foreground">{tier.period}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {tier.description}
                </p>
                <Button
                  className="mt-8 w-full cursor-pointer rounded-full"
                  variant={tier.highlighted ? "default" : "outline"}
                  render={
                    <Link href={tier.name === "Enterprise" ? "#" : "/signup"} />
                  }
                >
                  {tier.cta}
                </Button>
                <ul className="mt-8 flex flex-1 flex-col gap-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.25} />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </RevealItem>
          ))}
        </RevealStagger>

        <Reveal className="mx-auto mt-12 max-w-xl text-center">
          <p className="text-xs text-muted-foreground">
            Taxes and implementation may vary. Enterprise plans include custom terms.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
