import type { ReactNode } from "react";

/** Outer frame + inner cream surface — matches generated-page (1).html body treatment */
export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden border-[clamp(0.5rem,1vw,1rem)] border-[#FDFBF7] bg-[#DCD8D0]">
      <div
        className="pointer-events-none fixed inset-[clamp(0.5rem,1vw,1rem)] z-50 border border-[#DCD8D0]"
        aria-hidden
      />
      <div className="relative bg-[#FDFBF7]">{children}</div>
    </div>
  );
}
