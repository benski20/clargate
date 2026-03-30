"use client";

import { ShieldCheck, Lock, MapPin, Server } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal, RevealStagger, RevealItem } from "@/components/motion";

const badges = [
  { icon: ShieldCheck, label: "SOC 2 ready" },
  { icon: Lock, label: "HIPAA aligned" },
  { icon: MapPin, label: "US data residency" },
  { icon: Server, label: "Encryption in transit & at rest" },
];

export function TrustSection() {
  const reduced = useReducedMotion();

  return (
    <section className="border-t border-border/60 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Trust & security
          </p>
        </Reveal>

        <RevealStagger className="mt-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-8 md:gap-x-16">
          {badges.map((item) => (
            <RevealItem key={item.label}>
              <motion.div
                className="flex cursor-default items-center gap-3 text-muted-foreground"
                whileHover={
                  reduced
                    ? undefined
                    : { y: -1, transition: { duration: 0.2 } }
                }
              >
                <item.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                <span className="text-sm font-medium tracking-tight">{item.label}</span>
              </motion.div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
