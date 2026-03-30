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
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-14",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.25] motion-reduce:opacity-15"
        style={{
          backgroundImage:
            "linear-gradient(to right, #DCD8D0 1px, transparent 1px), linear-gradient(to bottom, #DCD8D0 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 10 }}
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
