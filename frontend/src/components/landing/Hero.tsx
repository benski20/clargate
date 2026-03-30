import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-success/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            AI-Powered IRB Review Platform
          </div>

          <h1 className="font-[var(--font-heading)] text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            The modern way to manage{" "}
            <span className="text-primary">IRB submissions</span>
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
            Replace fragmented email threads, legacy tools, and manual workflows
            with a single intelligent platform. From submission to approval,
            Clargate makes IRB review faster, clearer, and less painful.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="gap-2 text-base" render={<Link href="/signup" />}>
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base"
              render={<a href="#how-it-works" />}
            >
              See How It Works
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            No credit card required. SOC 2 ready. HIPAA-aligned.
          </p>
        </div>
      </div>
    </section>
  );
}
