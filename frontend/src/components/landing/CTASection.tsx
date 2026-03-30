"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion";

export function CTASection() {
  const reduced = useReducedMotion();

  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <motion.div
            className="relative overflow-hidden rounded-3xl border border-primary/20 bg-primary px-8 py-14 text-center shadow-xl shadow-primary/20 md:px-16 md:py-20"
            whileHover={
              reduced
                ? undefined
                : { boxShadow: "0 25px 50px -12px oklch(0.44 0.19 264 / 0.35)" }
            }
            transition={{ duration: 0.3 }}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
            </div>

            <h2 className="relative font-[var(--font-heading)] text-3xl font-semibold tracking-tight text-primary-foreground sm:text-4xl">
              Ready for a quieter IRB operation?
            </h2>
            <p className="relative mx-auto mt-4 max-w-lg text-base leading-relaxed text-primary-foreground/85">
              Move your institution from reactive email threads to a single, governed workspace —
              with a trial that respects your time.
            </p>
            <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Button
                size="lg"
                variant="secondary"
                className="h-12 cursor-pointer gap-2 rounded-full px-8 text-base font-medium shadow-md"
                render={<Link href="/signup" />}
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-12 cursor-pointer rounded-full border border-primary-foreground/25 bg-transparent px-8 text-base font-medium text-primary-foreground hover:bg-white/10"
              >
                Book a walkthrough
              </Button>
            </div>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}
