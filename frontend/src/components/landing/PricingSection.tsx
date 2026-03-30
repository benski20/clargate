import { Check } from "lucide-react";

const tiers = [
  {
    name: "Starter",
    price: "$499",
    suffix: "/ mo",
    desc: "For smaller institutions needing core capabilities and pipeline visibility.",
    featured: false,
    features: [
      "Capped yearly submissions",
      "Core AI summaries",
      "Unified messaging & storage",
      "Email notifications",
    ],
  },
  {
    name: "Professional",
    price: "$999",
    suffix: "/ mo",
    desc: "The complete workflow engine for active research organizations.",
    featured: true,
    badge: "Standard",
    features: [
      "Unlimited submissions",
      "Full AI PI Assistant",
      "Revision letter drafting",
      "SSO / SAML integration",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    suffix: "",
    desc: "Dedicated architecture and custom compliance structures.",
    featured: false,
    features: [
      "BAA & Custom contracts",
      "Dedicated success manager",
      "Migration assistance",
      "Optional on-premise deployment",
    ],
  },
];

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative border-b border-[#DCD8D0] bg-[#FDFBF7] py-[clamp(6rem,10vw,10rem)]"
    >
      <div className="relative z-10 mx-auto max-w-[clamp(90rem,95vw,120rem)] px-[clamp(1.5rem,5vw,4rem)]">
        <div className="mb-[clamp(4rem,6vw,6rem)] flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <div className="mb-6 font-mono text-xs tracking-[0.15em] text-[#555555] uppercase">
              Institutional Access
            </div>
            <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2rem,3.25vw,3.25rem)] leading-[0.95] font-light tracking-tighter text-[#0A0A0A]">
              One subscription.
              <br />
              <span className="italic text-[#555555]">Zero per-seat math.</span>
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-0 border border-[#DCD8D0] md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col border-b border-[#DCD8D0] p-[clamp(2rem,3vw,3rem)] transition-colors duration-500 last:border-b-0 hover:bg-[#F4F1EA] md:border-r md:border-b-0 md:last:border-r-0 ${
                tier.featured ? "bg-[#0A0A0A] text-[#FDFBF7] hover:bg-[#0A0A0A]" : ""
              }`}
            >
              {tier.featured && tier.badge ? (
                <div className="absolute top-0 right-0 bg-[#D9381E] px-4 py-2 font-mono text-[0.55rem] tracking-[0.15em] text-[#FDFBF7] uppercase">
                  {tier.badge}
                </div>
              ) : null}
              <div
                className={`mb-4 font-mono text-xs tracking-[0.15em] uppercase ${
                  tier.featured ? "text-white/70" : "text-[#0A0A0A]"
                }`}
              >
                {tier.name}
              </div>
              <div
                className={`mb-4 font-[family-name:var(--font-heading)] text-[2.125rem] font-light tracking-tight md:text-[2.25rem] ${
                  tier.featured ? "text-[#FDFBF7]" : "text-[#0A0A0A]"
                }`}
              >
                {tier.price}{" "}
                {tier.suffix ? (
                  <span
                    className={`font-sans text-base font-light ${
                      tier.featured ? "text-white/50" : "text-[#555555]"
                    }`}
                  >
                    {tier.suffix}
                  </span>
                ) : null}
              </div>
              <p
                className={`mb-8 border-b pb-8 font-sans text-[clamp(1rem,1.05vw,1.125rem)] font-light ${
                  tier.featured
                    ? "border-white/20 text-white/70"
                    : "border-[#DCD8D0] text-[#555555]"
                }`}
              >
                {tier.desc}
              </p>
              <ul className="mb-12 flex flex-grow flex-col gap-4 font-sans text-sm font-light">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <Check
                      className={`size-4 shrink-0 ${
                        tier.featured ? "text-[#D9381E]" : "text-[#555555]"
                      }`}
                      strokeWidth={1.5}
                    />
                    <span className={tier.featured ? "text-[#FDFBF7]" : "text-[#0A0A0A]"}>{f}</span>
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
