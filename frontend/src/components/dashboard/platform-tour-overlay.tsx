"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  PLATFORM_TOUR_QUERY,
  intakeWizardStepBadge,
  platformGuideStepPath,
  platformGuideSteps,
  platformTourUrl,
  stepMatchesPath,
  stripPlatformTour,
} from "@/lib/platform-guide";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

function parseTourStep(raw: string | null): number | null {
  if (raw === null || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function PlatformTourOverlay({ appUser }: { appUser: User }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const role = appUser.role;
  const steps = React.useMemo(() => platformGuideSteps(role), [role]);
  const tourSearch = searchParams.toString();
  const stepParam = parseTourStep(searchParams.get(PLATFORM_TOUR_QUERY));
  const active = stepParam !== null;

  const step = React.useMemo(() => {
    if (stepParam === null) return null;
    return Math.min(stepParam, steps.length - 1);
  }, [stepParam, steps.length]);

  React.useEffect(() => {
    if (stepParam === null) return;
    const max = steps.length - 1;
    if (stepParam > max) {
      router.replace(platformTourUrl(platformGuideStepPath(steps[max]), max));
    }
  }, [stepParam, steps, router]);

  React.useEffect(() => {
    if (stepParam === null || step === null) return;
    const def = steps[step];
    if (!def) return;
    if (stepMatchesPath(def, pathname, tourSearch)) return;
    router.replace(platformTourUrl(platformGuideStepPath(def), step));
  }, [stepParam, step, steps, pathname, tourSearch, router]);

  const exitTour = React.useCallback(() => {
    router.replace(stripPlatformTour(pathname, tourSearch));
  }, [router, pathname, tourSearch]);

  React.useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        exitTour();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, exitTour]);

  if (!active || step === null) return null;

  const def = steps[step];
  if (!def) return null;

  const last = step >= steps.length - 1;
  const first = step === 0;
  const hasTourScreen = Boolean(def.tourPath);
  const intakeBadge = intakeWizardStepBadge(def.tourPath);
  const progress = ((step + 1) / steps.length) * 100;

  function goToStep(next: number) {
    const target = steps[next];
    if (!target) return;
    router.push(platformTourUrl(platformGuideStepPath(target), next));
  }

  return (
    <>
      {!hasTourScreen ? (
        <button
          type="button"
          aria-label="Exit tour"
          className="fixed inset-0 z-[100] cursor-default bg-black/5 backdrop-blur-[1px] dark:bg-black/20"
          onClick={exitTour}
        />
      ) : null}

      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[102] overflow-hidden rounded-t-2xl border border-border/60 bg-popover shadow-2xl",
          "sm:bottom-6 sm:left-auto sm:right-6 sm:w-full sm:max-w-[26rem] sm:rounded-2xl",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-tour-title"
        aria-describedby="platform-tour-body"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-1 bg-primary/20 transition-all duration-500"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
        >
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              {def.phase ? (
                <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-primary/70">
                  {def.phase}
                </span>
              ) : null}
              <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {intakeBadge ?? `Step ${step + 1} of ${steps.length}`}
                {hasTourScreen ? " · Live preview" : ""}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={exitTour}
              aria-label="Close tour"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          <h2
            id="platform-tour-title"
            className="font-sans text-[1.1rem] font-semibold leading-tight tracking-tight text-foreground sm:text-lg"
          >
            {def.title}
          </h2>
          <p
            id="platform-tour-body"
            className="mt-2.5 text-[0.82rem] leading-relaxed text-muted-foreground"
          >
            {def.body}
          </p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              disabled={first}
              onClick={() => goToStep(step - 1)}
            >
              <ChevronLeft className="size-3.5" />
              Back
            </Button>
            {last ? (
              <Button type="button" size="sm" onClick={exitTour}>
                Done
              </Button>
            ) : (
              <Button type="button" size="sm" className="gap-1" onClick={() => goToStep(step + 1)}>
                Next
                <ChevronRight className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
