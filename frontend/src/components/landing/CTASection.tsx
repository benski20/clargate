import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center shadow-2xl shadow-primary/20 md:px-16 md:py-24">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          </div>

          <h2 className="font-[var(--font-heading)] text-3xl font-bold text-primary-foreground sm:text-4xl">
            Ready to modernize your IRB process?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
            Join institutions replacing legacy systems with Clargate. Start your
            free trial today — no credit card required.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              variant="secondary"
              className="gap-2 text-base cursor-pointer"
              render={<Link href="/signup" />}
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="text-base text-primary-foreground hover:bg-white/10 hover:text-primary-foreground cursor-pointer"
            >
              Request a Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
