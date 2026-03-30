import { LandingShell } from "@/components/landing/LandingShell";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { MarqueeSection } from "@/components/landing/MarqueeSection";
import { GapSection } from "@/components/landing/GapSection";
import { WorkflowSection } from "@/components/landing/WorkflowSection";
import { CapabilitiesSection } from "@/components/landing/CapabilitiesSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { ContactSection } from "@/components/landing/ContactSection";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <LandingShell>
      <Navbar />
      <main className="relative z-10 mt-[clamp(3.5rem,5vw,4.5rem)] bg-[#FDFBF7]">
        <Hero />
        <MarqueeSection />
        <GapSection />
        <WorkflowSection />
        <CapabilitiesSection />
        <PricingSection />
        <ContactSection />
      </main>
      <Footer />
    </LandingShell>
  );
}
