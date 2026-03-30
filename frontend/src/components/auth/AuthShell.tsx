"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function AuthShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-14",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-30%,oklch(0.94_0.03_250),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0.99_0.005_250),oklch(0.985_0.008_250))]" />
        <div
          className="absolute inset-0 opacity-[0.35] motion-reduce:opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, oklch(0.75 0.02 250 / 0.35) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute -left-32 top-1/3 h-80 w-80 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-primary/[0.05] blur-3xl" />
      </div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduced ? 0 : 0.4,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="w-full max-w-md"
      >
        {children}
      </motion.div>
    </div>
  );
}
