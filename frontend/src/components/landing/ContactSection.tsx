"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

export function ContactSection() {
  const [org, setOrg] = useState("");
  const [volume, setVolume] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent("Clargate trial provisioning request");
    const body = encodeURIComponent(
      `Institution: ${org}\nApproximate annual submissions: ${volume}\nContact email: ${email}`
    );
    window.location.href = `mailto:partners@clargate.com?subject=${subject}&body=${body}`;
  }

  return (
    <section
      id="contact"
      className="relative overflow-hidden border-b border-[#DCD8D0] bg-[#0A0A0A] py-[clamp(8rem,16vw,16rem)] text-[#FDFBF7]"
    >
      <div className="relative z-10 mx-auto max-w-[clamp(90rem,95vw,100rem)] px-[clamp(1.5rem,5vw,4rem)]">
        <div className="mb-12 flex items-center gap-4 font-mono text-xs tracking-[0.15em] text-white/50 uppercase">
          <span className="size-2 animate-pulse rounded-full bg-[#FDFBF7]" />
          A quieter way to run IRB
        </div>

        <form onSubmit={handleSubmit} className="w-full">
          <h2 className="inline-block w-full font-[family-name:var(--font-heading)] text-[clamp(1.5rem,3.5vw,3.75rem)] leading-[1.55] font-light tracking-tight text-white/90">
            Initiate a trial. <br className="hidden md:block" />
            My institution is{" "}
            <input
              type="text"
              name="organization"
              placeholder="Organization Name"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              className="mad-lib-input mx-[1vw] w-[clamp(12rem,25vw,30rem)] border-b border-white/30 bg-transparent text-center text-[clamp(1.35rem,3vw,2.5rem)] font-[family-name:var(--font-heading)] text-[#FDFBF7] placeholder:text-white/20 focus:border-white focus:outline-none"
              required
            />
            , and we process roughly{" "}
            <input
              type="text"
              name="volume"
              placeholder="volume"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className="mad-lib-input mx-[1vw] w-[clamp(6rem,15vw,20rem)] border-b border-white/30 bg-transparent text-center text-[clamp(1.35rem,3vw,2.5rem)] font-[family-name:var(--font-heading)] text-[#FDFBF7] placeholder:text-white/20 focus:border-white focus:outline-none"
              required
            />{" "}
            submissions per year. You can coordinate access with me at{" "}
            <input
              type="email"
              name="email"
              placeholder="admin@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mad-lib-input mx-[1vw] mt-4 w-[clamp(15rem,30vw,40rem)] border-b border-white/30 bg-transparent text-center text-[clamp(1.35rem,3vw,2.5rem)] font-[family-name:var(--font-heading)] text-[#FDFBF7] placeholder:text-white/20 focus:border-white focus:outline-none md:mt-0"
              required
            />
            .
          </h2>

          <div className="mt-[clamp(4rem,8vw,8rem)] flex flex-col items-start justify-between gap-12 border-t border-white/10 pt-12 md:flex-row md:items-center">
            <div className="flex flex-col gap-12 sm:flex-row">
              <div>
                <span className="mb-2 block font-mono text-[clamp(0.65rem,0.8vw,0.75rem)] tracking-[0.15em] text-white/40 uppercase">
                  Direct Inquiry
                </span>
                <a
                  href="mailto:partners@clargate.com"
                  className="font-sans text-[clamp(1rem,1.05vw,1.125rem)] font-light text-[#FDFBF7] transition-colors hover:text-white/70"
                >
                  partners@clargate.com
                </a>
              </div>
              <div>
                <span className="mb-2 block font-mono text-[clamp(0.65rem,0.8vw,0.75rem)] tracking-[0.15em] text-white/40 uppercase">
                  Data Residency
                </span>
                <span className="font-sans text-[clamp(1rem,1.05vw,1.125rem)] font-light text-[#FDFBF7]">
                  US East (N. Virginia)
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="group/btn inline-flex items-center gap-4 rounded-full bg-[#FDFBF7] px-12 py-5 font-mono text-xs tracking-[0.15em] text-[#0A0A0A] uppercase transition-colors duration-300 hover:bg-[#F4F1EA]"
            >
              <span>Request Provisioning</span>
              <ArrowRight className="size-[1.2rem] transition-transform duration-500 group-hover/btn:translate-x-2" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
