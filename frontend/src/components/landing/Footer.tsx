import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative z-10 overflow-hidden border-t border-white/5 bg-[#0A0A0A] text-[#FDFBF7]">
      <div className="w-full border-b border-white/10">
        <h2 className="select-none py-[clamp(2rem,5vw,5rem)] text-center font-[family-name:var(--font-heading)] text-[clamp(3rem,14vw,18rem)] leading-[0.8] font-light tracking-tighter text-[#FDFBF7] uppercase">
          ARIBTER
        </h2>
      </div>

      <div className="relative z-10 mx-auto grid max-w-[clamp(90rem,95vw,140rem)] grid-cols-1 gap-[clamp(3rem,6vw,5rem)] px-[clamp(1.5rem,5vw,4rem)] py-[clamp(4rem,8vw,6rem)] md:grid-cols-12">
        <div className="flex flex-col justify-between md:col-span-4">
          <p className="max-w-80 font-sans text-[clamp(1rem,1.05vw,1.125rem)] leading-[1.6] font-light text-white/60">
            One governed workspace for investigators, administrators, and reviewers. Built for serious
            compliance review.
          </p>
        </div>

        <div className="flex flex-col gap-4 font-sans text-[clamp(1rem,1.05vw,1.125rem)] font-light text-white/60 md:col-span-2 md:col-start-7">
          <span className="mb-2 font-mono text-[clamp(0.65rem,0.8vw,0.75rem)] tracking-[0.15em] text-[#FDFBF7] uppercase">
            Platform
          </span>
          <a href="#workflow" className="transition-colors hover:text-[#FDFBF7]">
            Workflow
          </a>
          <a href="#capabilities" className="transition-colors hover:text-[#FDFBF7]">
            Capabilities
          </a>
          <a href="#pricing" className="transition-colors hover:text-[#FDFBF7]">
            Pricing
          </a>
          <Link href="/login" className="transition-colors hover:text-[#FDFBF7]">
            Sign in
          </Link>
        </div>

        <div className="flex flex-col gap-4 font-sans text-[clamp(1rem,1.05vw,1.125rem)] font-light text-white/60 md:col-span-2">
          <span className="mb-2 font-mono text-[clamp(0.65rem,0.8vw,0.75rem)] tracking-[0.15em] text-[#FDFBF7] uppercase">
            Resources
          </span>
          <span className="text-white/40">Documentation</span>
          <span className="text-white/40">API Reference</span>
          <span className="text-white/40">Security Posture</span>
        </div>

        <div className="flex flex-col gap-4 font-sans text-[clamp(1rem,1.05vw,1.125rem)] font-light text-white/60 md:col-span-2">
          <span className="mb-2 font-mono text-[clamp(0.65rem,0.8vw,0.75rem)] tracking-[0.15em] text-[#FDFBF7] uppercase">
            Legal
          </span>
          <span className="text-white/40">Privacy Policy</span>
          <span className="text-white/40">Terms of Service</span>
          <span className="text-white/40">BAA Details</span>
        </div>
      </div>

      <div className="flex w-full flex-col items-center justify-between gap-4 border-t border-white/10 bg-[#050505] px-[clamp(1.5rem,5vw,4rem)] py-8 font-mono text-[clamp(0.65rem,0.8vw,0.75rem)] tracking-[0.15em] text-white/30 uppercase sm:flex-row">
        <span>© {new Date().getFullYear()} Aribter Systems Inc.</span>
        <span>All systems operational.</span>
      </div>
    </footer>
  );
}
