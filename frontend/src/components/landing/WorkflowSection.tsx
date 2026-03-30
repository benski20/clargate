import Image from "next/image";

const panels = [
  {
    step: "01 / Submit",
    title: "Intake",
    body: "Investigators complete a guided intake with AI assistance. Documents and answers live in one unified portal.",
    src: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1600&auto=format&fit=crop",
    alt: "Submit",
  },
  {
    step: "02 / Review",
    title: "Triage",
    body: "Admins triage with auto-generated summaries, assign reviewers, and draft revision letters with intelligent support.",
    src: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=1600&auto=format&fit=crop",
    alt: "Review",
  },
  {
    step: "03 / Decide",
    title: "Outcome",
    body: "Structured evaluations lead to clear decisions and automated renewal reminders—eliminating the email chase.",
    src: "https://images.unsplash.com/photo-1507208773393-40d9fc670acf?q=80&w=1600&auto=format&fit=crop",
    alt: "Decide",
  },
];

export function WorkflowSection() {
  return (
    <section id="workflow" className="relative flex flex-col overflow-hidden border-b border-[#DCD8D0] bg-[#0A0A0A] text-[#FDFBF7]">
      <div className="relative z-10 flex flex-col items-start justify-between gap-8 border-b border-white/10 bg-[#0A0A0A] px-[clamp(1.5rem,5vw,4rem)] py-[clamp(3rem,6vw,4rem)] md:flex-row md:items-end">
        <div>
          <div className="mb-6 block font-mono text-xs tracking-[0.15em] text-white/50 uppercase">
            The Protocol
          </div>
          <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2.25rem,5vw,5.5rem)] leading-[0.95] font-light tracking-tighter text-[#FDFBF7]">
            Three steps to
            <br />
            <span className="italic text-white/50">decision.</span>
          </h2>
        </div>
        <p className="max-w-80 font-sans text-[clamp(1rem,1.05vw,1.125rem)] leading-[1.6] font-light text-white/70">
          Every step is logged so teams can answer who did what, and when, without digging through
          inboxes.
        </p>
      </div>

      <div className="h-accordion-container flex w-full flex-col border-b border-white/10 md:h-[75vh] md:flex-row">
        {panels.map((p, i) => (
          <div
            key={p.step}
            className="h-accordion-item group relative flex min-h-[50vh] flex-col justify-end overflow-hidden border-b border-white/10 bg-[#111] md:min-h-0 md:border-r md:border-b-0 last:border-r-0"
          >
            <Image
              priority={i === 0}
              src={p.src}
              alt={p.alt}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover opacity-40 grayscale transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:opacity-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/50 to-transparent opacity-80 transition-opacity duration-700 group-hover:opacity-40" />

            <div className="pointer-events-none relative z-10 flex h-full flex-col justify-between p-[clamp(2rem,3vw,3rem)]">
              <div className="font-mono text-xs text-white/50">{p.step}</div>
              <div>
                <h3 className="mb-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3.25vw,3.25rem)] leading-none font-light tracking-tight text-[#FDFBF7] transition-transform duration-700 translate-y-4 group-hover:translate-y-0">
                  {p.title}
                </h3>
                <p className="max-w-80 font-sans text-[clamp(1rem,1.05vw,1.125rem)] leading-[1.6] font-light text-white/80 opacity-0 transition-all delay-100 duration-700 translate-y-4 group-hover:translate-y-0 group-hover:opacity-100">
                  {p.body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
