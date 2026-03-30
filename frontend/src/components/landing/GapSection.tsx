"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

function SyncBlock({ children }: { children: React.ReactNode }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.35, margin: "-20% 0px -20% 0px" });
  return (
    <motion.p
      ref={ref}
      className={`sync-text font-[family-name:var(--font-heading)] text-[clamp(1.65rem,3.25vw,3.5rem)] leading-[1.12] font-light tracking-tight text-[#0A0A0A] ${inView ? "active" : ""}`}
    >
      {children}
    </motion.p>
  );
}

export function GapSection() {
  return (
    <section
      id="gap"
      className="relative overflow-hidden border-b border-[#DCD8D0] bg-[#FDFBF7] py-[clamp(6rem,12vw,12rem)]"
    >
      <div className="pointer-events-none absolute inset-0 hidden opacity-20 md:grid md:grid-cols-12">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="border-r border-[#DCD8D0] last:border-r-0" />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex max-w-[140rem] flex-col gap-[clamp(4rem,8vh,6rem)] px-[clamp(1.5rem,5vw,4rem)]">
        <div className="grid grid-cols-1 gap-[clamp(1.5rem,5vw,4rem)] md:grid-cols-12">
          <div className="mt-2 font-mono text-xs tracking-[0.15em] text-[#555555] uppercase md:col-span-2">
            01 / Fragmented
          </div>
          <div className="border-t border-[#DCD8D0] pt-8 md:col-span-8">
            <SyncBlock>
              Submissions are scattered across email, PDFs, and spreadsheets—leaving teams with{" "}
              <span className="italic text-[#555555]">no single source of truth</span> for status.
            </SyncBlock>
          </div>
        </div>

        <div className="mt-[clamp(2rem,5vw,4rem)] grid grid-cols-1 gap-[clamp(1.5rem,5vw,4rem)] md:grid-cols-12">
          <div className="mt-2 font-mono text-xs tracking-[0.15em] text-[#555555] uppercase md:col-span-2 md:col-start-3 md:pr-8 md:text-right">
            02 / Delayed
          </div>
          <div className="border-t border-[#DCD8D0] pt-8 md:col-span-8">
            <SyncBlock>
              Administrators lose hours coaching rewrites, chasing down documents, and{" "}
              <span className="italic text-[#555555]">drafting revision letters by hand</span>.
            </SyncBlock>
          </div>
        </div>

        <div className="mt-[clamp(2rem,5vw,4rem)] grid grid-cols-1 gap-[clamp(1.5rem,5vw,4rem)] md:grid-cols-12">
          <div className="mt-2 font-mono text-xs tracking-[0.15em] text-[#555555] uppercase md:col-span-2 md:col-start-5 md:pr-8 md:text-right">
            03 / Unpredictable
          </div>
          <div className="border-t border-[#DCD8D0] pt-8 md:col-span-6">
            <SyncBlock>
              Guidelines are interpreted differently across reviewers, resulting in{" "}
              <span className="italic text-[#555555]">inconsistent outcomes</span> for
              investigators.
            </SyncBlock>
          </div>
        </div>

        <div className="mt-[clamp(2rem,5vw,4rem)] grid grid-cols-1 md:grid-cols-12">
          <div className="border-t border-[#0A0A0A] pt-8 md:col-span-8 md:col-start-3">
            <p className="font-sans text-base font-light leading-relaxed text-[#0A0A0A] md:text-lg">
              Legacy IRB workflows were not built for today. Most teams still stitch together tools
              from another era. Aribter replaces that patchwork with one governed workspace — built
              for compliance and speed.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
