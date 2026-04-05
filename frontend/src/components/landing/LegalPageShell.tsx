import type { ReactNode } from "react";
import Link from "next/link";
import { LandingShell } from "@/components/landing/LandingShell";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export function LegalPageShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <LandingShell>
      <Navbar />
      <main className="relative z-10 mt-[clamp(3.5rem,5vw,4.5rem)] min-h-screen bg-[#FDFBF7]">
        <div className="mx-auto max-w-3xl px-[clamp(1.5rem,5vw,4rem)] py-12 md:py-16">
          <Link
            href="/"
            className="font-mono text-xs tracking-[0.15em] text-[#0A0A0A]/60 uppercase transition-colors hover:text-[#0A0A0A]"
          >
            ← Back to home
          </Link>
          <h1 className="mt-8 font-[family-name:var(--font-heading)] text-3xl font-normal tracking-tight text-[#0A0A0A] md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 font-mono text-[0.65rem] tracking-[0.15em] text-[#0A0A0A]/50 uppercase">
            Last updated {lastUpdated}
          </p>
          <div className="mt-10 space-y-8 text-base leading-[1.75] text-[#0A0A0A]/85">{children}</div>
        </div>
      </main>
      <Footer />
    </LandingShell>
  );
}
