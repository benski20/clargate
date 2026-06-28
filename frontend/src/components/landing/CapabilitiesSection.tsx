import { BookOpen, CheckCircle2, Cpu, MessageSquare, ScanSearch, ShieldCheck } from "lucide-react";

export function CapabilitiesSection() {
  return (
    <section
      id="capabilities"
      className="relative border-b border-[#DCD8D0] bg-[#F4F1EA] py-[clamp(6rem,12vw,12rem)]"
    >
      <div className="mx-auto grid max-w-[clamp(90rem,95vw,120rem)] grid-cols-1 items-start gap-[clamp(4rem,8vw,10rem)] px-[clamp(1.5rem,5vw,4rem)] md:grid-cols-12">
        <div className="md:sticky md:top-[clamp(6rem,10vw,10rem)] md:col-span-5">
          <div className="mb-6 font-mono text-xs tracking-[0.15em] text-[#555555] uppercase">
            Platform Pillars
          </div>
          <h2 className="mb-8 font-[family-name:var(--font-heading)] text-[clamp(2.25rem,5vw,5.5rem)] leading-[0.95] font-light tracking-tighter text-[#0A0A0A]">
            Functional
            <br />
            <span className="italic text-[#555555]">Architecture.</span>
          </h2>
          <p className="mb-8 font-sans text-[clamp(1.1rem,1.2vw,1.25rem)] leading-[1.7] font-light text-[#555555]">
            The system carries built-in knowledge of federal research regulations — it predicts
            review categories, catches compliance problems, and drafts language your team would
            otherwise write by hand. Every final decision stays with your board.
          </p>
          <div className="flex flex-col gap-4 border-t border-[#DCD8D0] pt-8 font-mono text-xs text-[#0A0A0A]">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="size-4 shrink-0 text-[#555555]" />
              Trained on 45 CFR 46, 21 CFR 50/56, and the Common Rule
            </div>
            <div className="flex items-center gap-4">
              <CheckCircle2 className="size-4 shrink-0 text-[#555555]" />
              Role-aware surfaces for PIs, Admins, Reviewers
            </div>
            <div className="flex items-center gap-4">
              <CheckCircle2 className="size-4 shrink-0 text-[#555555]" />
              MFA-ready authentication flows
            </div>
          </div>
        </div>

        <div className="relative flex flex-col pb-[10vh] md:col-span-7">
          <div className="group sticky top-[12vh] mb-16 overflow-hidden border border-[#DCD8D0] bg-[#FDFBF7] p-[clamp(2rem,4vw,4rem)] shadow-2xl shadow-[#0A0A0A]/5">
            <div className="line-x" />
            <div className="line-y" />
            <div className="mb-8 flex items-start justify-between">
              <div className="font-mono text-[1.75rem] leading-none text-[#555555]/30">01</div>
              <BookOpen className="size-9 text-[#0A0A0A]" strokeWidth={1.25} />
            </div>
            <h3 className="mb-4 font-[family-name:var(--font-heading)] text-[clamp(1.5rem,2.5vw,2.25rem)] leading-[1.1] font-light tracking-tight text-[#0A0A0A]">
              Built on Federal Regulation
            </h3>
            <p className="mb-4 font-sans text-[clamp(1rem,1.05vw,1.125rem)] leading-[1.65] font-light text-[#555555]">
              The system knows the Common Rule, FDA human-subjects requirements (21 CFR 50/56),
              HIPAA, and your institutional policies. It references the same regulatory text
              your board does.
            </p>
            <p className="font-sans text-[clamp(1rem,1.05vw,1.125rem)] leading-[1.65] font-light text-[#555555]">
              When a protocol arrives, it reads the submission and supporting documents, then
              predicts the review category — exempt, expedited, or full board — before an
              administrator opens it.
            </p>
          </div>

          <div className="group sticky top-[17vh] mb-16 overflow-hidden border border-[#DCD8D0] bg-[#FDFBF7] p-[clamp(2rem,4vw,4rem)] shadow-2xl shadow-[#0A0A0A]/5">
            <div className="line-x" />
            <div className="line-y" />
            <div className="mb-8 flex items-start justify-between">
              <div className="font-mono text-[1.75rem] leading-none text-[#555555]/30">02</div>
              <ScanSearch className="size-9 text-[#0A0A0A]" strokeWidth={1.25} />
            </div>
            <h3 className="mb-4 font-[family-name:var(--font-heading)] text-[clamp(1.5rem,2.5vw,2.25rem)] leading-[1.1] font-light tracking-tight text-[#0A0A0A]">
              Compliance Checks Before Review
            </h3>
            <p className="mb-4 font-sans text-[clamp(1rem,1.05vw,1.125rem)] leading-[1.65] font-light text-[#555555]">
              Every submission is checked for common problems before it reaches a reviewer — missing
              consent language, incomplete risk disclosures, vulnerable-population safeguards that
              fall short of regulatory requirements.
            </p>
            <p className="font-sans text-[clamp(1rem,1.05vw,1.125rem)] leading-[1.65] font-light text-[#555555]">
              Each issue comes with an explanation and a reference to the relevant regulation, so
              investigators can fix problems before formal review begins.
            </p>
          </div>

          <div className="group sticky top-[22vh] mb-16 overflow-hidden border border-[#DCD8D0] bg-[#E8E4DB] p-[clamp(2rem,4vw,4rem)] shadow-2xl shadow-[#0A0A0A]/5">
            <div className="line-x" />
            <div className="line-y" />
            <div className="mb-8 flex items-start justify-between">
              <div className="font-mono text-[2rem] leading-none text-[#555555]/30">03</div>
              <ShieldCheck className="size-9 text-[#0A0A0A]" strokeWidth={1.25} />
            </div>
            <h3 className="mb-4 font-[family-name:var(--font-heading)] text-[clamp(1.5rem,2.5vw,2.25rem)] leading-[1.1] font-light tracking-tight text-[#0A0A0A]">
              Governance by Design
            </h3>
            <p className="font-sans text-[clamp(1rem,1.05vw,1.125rem)] leading-[1.65] font-light text-[#555555]">
              Strict role-based access controls and an immutable, append-only audit trail structured
              specifically for serious compliance review and institutional security requirements.
            </p>
          </div>

          <div className="group sticky top-[27vh] overflow-hidden border border-[#0A0A0A] bg-[#0A0A0A] p-[clamp(2rem,4vw,4rem)] text-[#FDFBF7] shadow-2xl shadow-[#0A0A0A]/20">
            <div className="mb-8 flex items-start justify-between">
              <div className="font-mono text-[1.75rem] leading-none text-white/30">04</div>
              <MessageSquare className="size-9 text-[#FDFBF7]" strokeWidth={1.25} />
            </div>
            <h3 className="mb-4 font-[family-name:var(--font-heading)] text-[clamp(1.5rem,2.5vw,2.25rem)] leading-[1.1] font-light tracking-tight text-[#FDFBF7]">
              Unified Threads
            </h3>
            <p className="font-sans text-[clamp(1rem,1.05vw,1.125rem)] leading-[1.65] font-light text-white/70">
              Every proposal has its own conversation thread. Attachments, reminders, and discussion
              live alongside the submission — nothing gets lost between email, shared drives, and
              spreadsheets.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
