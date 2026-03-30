import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Starter",
    price: "$499",
    period: "/month",
    description: "For smaller institutions getting started with modern IRB tooling.",
    features: [
      "Up to 50 submissions/year",
      "3 admin seats",
      "AI proposal summaries",
      "Unified messaging",
      "Document storage",
      "Email notifications",
    ],
    cta: "Start Free Trial",
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
      "PI AI assistant",
      "SSO / SAML integration",
      "Audit log & compliance reporting",
      "Priority support",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large research institutions with advanced compliance needs.",
    features: [
      "Everything in Professional",
      "Dedicated success manager",
      "Custom SSO configuration",
      "Advanced analytics",
      "Data migration assistance",
      "BAA & custom contracts",
      "On-premise option available",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="bg-secondary/50 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Pricing
          </p>
          <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, per-institution pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No per-user fees. One subscription covers your entire institution.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-8 transition-all duration-200 ${
                tier.highlighted
                  ? "border-primary bg-white shadow-xl shadow-primary/10 scale-[1.02]"
                  : "border-border bg-card hover:shadow-lg"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </div>
              )}
              <h3 className="font-[var(--font-heading)] text-lg font-semibold text-foreground">
                {tier.name}
              </h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">
                  {tier.price}
                </span>
                <span className="text-muted-foreground">{tier.period}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {tier.description}
              </p>
              <Button
                className="mt-8 w-full cursor-pointer"
                variant={tier.highlighted ? "default" : "outline"}
                render={<Link href={tier.name === "Enterprise" ? "#" : "/signup"} />}
              >
                {tier.cta}
              </Button>
              <ul className="mt-8 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
