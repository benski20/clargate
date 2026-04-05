"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { cardVariants } from "@/components/ui/gradient-card";
import { cn } from "@/lib/utils";
import { platformGuideSteps, platformTourUrl } from "@/lib/platform-guide";
import type { UserRole } from "@/lib/types";

const linkClass =
  "group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-foreground";

export function PlatformGuideCard({ role }: { role: UserRole }) {
  const steps = platformGuideSteps(role);
  const startHref = platformTourUrl(steps[0].path, 0);

  const cardAnimation = {
    rest: { scale: 1, y: 0 },
    hover: { scale: 1.02, y: -2 },
  };

  return (
    <motion.div
      variants={cardAnimation}
      initial="rest"
      whileHover="hover"
      animate="rest"
      className="h-full"
    >
      <div className={cn(cardVariants({ gradient: "sky" }))}>
        <div className="flex min-h-0 flex-col h-full">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-background/50 px-3 py-1 text-xs font-medium text-foreground/80 backdrop-blur-sm w-fit md:text-sm">
            <span
              className="flex h-2 w-2 shrink-0 items-center justify-center rounded-full bg-sky-500"
              aria-hidden
            />
            Guide
          </div>

          <div className="flex-grow min-h-0">
            <h3 className="text-lg font-bold text-foreground mb-1.5 md:text-xl">
              How to use Arbiter
            </h3>
            <p className="text-sm text-foreground/70 max-w-[18rem] leading-relaxed">
              Walk through key screens with Next and Back—your page updates at each step.
            </p>
          </div>

          <Link href={startHref} className={linkClass}>
            Start guided tour
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
