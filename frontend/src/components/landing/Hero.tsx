"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const reduced = useReducedMotion();

  return (
    <section className="relative overflow-hidden pt-28 pb-24 md:pt-36 md:pb-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,oklch(0.99_0.015_252)_0%,oklch(0.985_0.008_252)_45%,oklch(0.98_0.006_252)_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.4] motion-reduce:opacity-[0.2]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, oklch(0.65 0.04 264 / 0.22) 1px, transparent 0)",
            backgroundSize: "48px 48px",
          }}
        />
        <motion.div
          className="absolute -left-40 top-20 h-[min(90vw,520px)] w-[min(90vw,520px)] rounded-full bg-primary/[0.07] blur-3xl"
          animate={
            reduced
              ? undefined
              : { scale: [1, 1.05, 1], opacity: [0.5, 0.65, 0.5] }
          }
          transition={
            reduced
              ? undefined
              : { duration: 14, repeat: Infinity, ease: "easeInOut" }
          }
        />
        <motion.div
          className="absolute -right-32 bottom-0 h-[min(80vw,440px)] w-[min(80vw,440px)] rounded-full bg-primary/[0.05] blur-3xl"
          animate={
            reduced
              ? undefined
              : { scale: [1.03, 1, 1.03], opacity: [0.4, 0.55, 0.4] }
          }
          transition={
            reduced
              ? undefined
              : { duration: 12, repeat: Infinity, ease: "easeInOut" }
          }
        />
        <div className="absolute left-1/2 top-[18%] h-px w-[min(92%,720px)] -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.5, ease }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground shadow-sm backdrop-blur-md"
          >
            <span className="h-1 w-1 rounded-full bg-primary" aria-hidden />
            IRB review, unified
          </motion.div>

          <motion.h1
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.55, delay: reduced ? 0 : 0.06, ease }}
            className="font-[var(--font-heading)] text-[2.35rem] font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem]"
          >
            The calm way to run{" "}
            <span className="text-primary">IRB submissions</span>
          </motion.h1>

          <motion.p
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.55, delay: reduced ? 0 : 0.12, ease }}
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            One deliberate workspace for investigators, admins, and reviewers —
            from intake to decision, without the inbox chaos.
          </motion.p>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.18, ease }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
          >
            <Button
              size="lg"
              className="h-12 cursor-pointer gap-2 rounded-full px-8 text-base font-medium shadow-lg shadow-primary/15 transition-shadow duration-200 hover:shadow-xl hover:shadow-primary/20"
              render={<Link href="/signup" />}
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 cursor-pointer rounded-full border-border/80 bg-card/50 px-8 text-base font-medium backdrop-blur-sm transition-colors duration-200 hover:bg-accent"
              render={<a href="#how-it-works" />}
            >
              How it works
            </Button>
          </motion.div>

          <motion.p
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.45, delay: reduced ? 0 : 0.28 }}
            className="mt-8 text-xs font-medium tracking-wide text-muted-foreground"
          >
            No credit card · Audit-ready · HIPAA-aligned posture
          </motion.p>
        </div>
      </div>
    </section>
  );
}
