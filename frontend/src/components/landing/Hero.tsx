import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-clamp(4.5rem,7vw,6.5rem))] flex-col overflow-hidden border-b border-[#DCD8D0]">
      <div className="relative z-10 flex w-full flex-col justify-center bg-[#FDFBF7] p-[clamp(1.5rem,5vw,4rem)]">
        <div className="absolute top-[clamp(2rem,4vw,4rem)] right-[clamp(2rem,4vw,4rem)] z-10 hidden text-right lg:block">
          <div className="mb-2 font-mono text-[clamp(0.65rem,0.8vw,0.75rem)] tracking-[0.15em] text-[#555555] uppercase">
            Network Status
          </div>
          <div className="flex items-center justify-end gap-2">
            <div className="size-[0.4rem] animate-pulse rounded-full bg-[#D9381E]" style={{ animationDuration: "3s" }} />
            <span className="font-sans text-xs font-light tracking-wide text-[#0A0A0A]">
              Accepting Institutions
            </span>
          </div>
          <div className="mt-2 font-mono text-[clamp(0.65rem,0.8vw,0.75rem)] tracking-[0.1em] text-[#DCD8D0]">
            SECURE / ENCRYPTED
          </div>
        </div>

        <div className="relative z-10 flex h-full w-full flex-col justify-between pt-[clamp(2rem,4vw,4rem)] pb-[clamp(2rem,4vw,4rem)] md:pb-0">
          <div className="self-start">
            <span className="rounded-full border border-[#DCD8D0] bg-[#FDFBF7]/50 px-4 py-2 font-mono text-xs tracking-[0.15em] text-[#555555] uppercase backdrop-blur-sm">
              AI-Assisted IRB
            </span>
          </div>

          <h1 className="font-[family-name:var(--font-heading)] relative z-10 mt-auto mb-[clamp(2rem,4vw,4rem)] flex w-full flex-col text-[clamp(2.5rem,6vw,7rem)] leading-[0.9] font-light tracking-tighter text-[#0A0A0A]">
            <span className="self-start">IRB operations,</span>
            <span className="self-start pl-[5%] md:pl-[10%]">
              <span className="italic text-[#555555]">distilled to</span>
            </span>
            <span className="self-start pl-[10%] text-[#0A0A0A] md:pl-[20%]">
              <span className="font-normal italic text-[#3D3D3D]">clarity.</span>
            </span>
          </h1>

          <div className="z-10 flex flex-col items-start gap-[clamp(2rem,4vw,4rem)] self-start bg-transparent sm:flex-row md:pl-[10%]">
            <div className="max-w-96 border-l border-[#0A0A0A] py-2 pl-[clamp(1.5rem,2vw,2rem)]">
              <p className="mb-6 max-w-[22rem] font-sans text-[clamp(1rem,1.05vw,1.125rem)] leading-[1.65] font-light text-[#555555]">
                A single workspace for investigators, administrators, and reviewers — from intake to
                decision, without the noise of scattered tools and inboxes.
              </p>
              <a
                href="#workflow"
                className="group inline-flex items-center gap-4 border-b border-[#0A0A0A] pb-1 font-mono text-xs tracking-[0.15em] text-[#0A0A0A] uppercase transition-colors duration-300 hover:border-[#D9381E] hover:text-[#D9381E]"
              >
                View Architecture
                <ArrowRight className="size-[1.2rem] transition-transform duration-500 group-hover:translate-x-2" />
              </a>
            </div>

            <div className="hidden flex-col gap-6 border-l border-[#DCD8D0] py-2 pl-[clamp(1.5rem,2vw,2rem)] xl:flex">
              <div>
                <div className="mb-1 font-[family-name:var(--font-heading)] text-lg leading-none tracking-tight text-[#0A0A0A] md:text-xl">
                  Audit-Oriented
                </div>
                <div className="font-mono text-[clamp(0.65rem,0.8vw,0.75rem)] tracking-[0.15em] text-[#555555] uppercase">
                  Append-only logs
                </div>
              </div>
              <div>
                <div className="mb-1 font-[family-name:var(--font-heading)] text-lg leading-none tracking-tight text-[#0A0A0A] md:text-xl">
                  Zero Friction
                </div>
                <div className="font-mono text-[clamp(0.65rem,0.8vw,0.75rem)] tracking-[0.15em] text-[#555555] uppercase">
                  No card required
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
