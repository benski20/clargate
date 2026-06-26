"use client";

import { Check, FileText, ShieldCheck, Scale, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type ReviewPhase = "idle" | "synthesizing" | "consent" | "compliance" | "done";

const STEPS = [
  { key: "synthesizing" as const, label: "Analyzing materials", icon: FileText },
  { key: "consent" as const, label: "Generating consent", icon: ShieldCheck },
  { key: "compliance" as const, label: "Regulatory review", icon: Scale },
];

const PHASE_INDEX: Record<ReviewPhase, number> = {
  idle: -1,
  synthesizing: 0,
  consent: 1,
  compliance: 2,
  done: 3,
};

function phaseProgress(phase: ReviewPhase): number {
  const idx = PHASE_INDEX[phase];
  if (idx <= 0) return 8;
  if (idx >= STEPS.length) return 100;
  return Math.round(((idx + 0.5) / STEPS.length) * 100);
}

export function AiReviewProgress({ phase }: { phase: ReviewPhase }) {
  const activeIndex = PHASE_INDEX[phase];
  const percent = phaseProgress(phase);

  return (
    <div
      className="flex flex-col items-center justify-center gap-6 rounded-xl border border-border/50 bg-muted/15 px-6 py-10"
      role="status"
      aria-live="polite"
      aria-label="AI review in progress"
    >
      <div className="w-full max-w-sm">
        <Progress value={percent} />
      </div>

      <div className="flex w-full max-w-md justify-between gap-2">
        {STEPS.map((step, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-2 text-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "border-2 border-primary bg-background text-primary"
                      : "border border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden />
                )}
              </div>
              <span
                className={`text-xs leading-tight ${
                  isDone || isActive ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {activeIndex === 2
          ? "Searching federal regulations and analyzing against 45 CFR 46. This may take up to two minutes."
          : "Processing your materials through the AI review pipeline."}
      </p>
    </div>
  );
}
