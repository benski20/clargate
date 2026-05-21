"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, X } from "lucide-react";

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

  /** Clamp invalid step indices in the URL to the last step. */
  React.useEffect(() => {
    if (stepParam === null) return;
    const max = steps.length - 1;
    if (stepParam > max) {
      router.replace(platformTourUrl(platformGuideStepPath(steps[max]), max));
    }
  }, [stepParam, steps, router]);

  /** Keep the visible page aligned with the tour step in the URL. */
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
          className="fixed inset-0 z-[100] cursor-default bg-transparent"
          onClick={exitTour}
        />
      ) : null}

      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[102] max-h-[min(52vh,420px)] overflow-y-auto rounded-t-2xl border border-border/80 bg-popover p-5 shadow-2xl ring-1 ring-border/60",
          "sm:bottom-6 sm:left-auto sm:right-6 sm:max-h-[min(70vh,480px)] sm:w-full sm:max-w-md sm:rounded-xl",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-tour-title"
        aria-describedby="platform-tour-body"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sky-600 dark:text-sky-400">
            <BookOpen className="size-4 shrink-0" aria-hidden />
            <span className="font-mono text-[0.65rem] font-normal uppercase tracking-[0.18em]">
              {intakeBadge ? (
                <>
                  {intakeBadge}
                  {" · Tour "}
                  {step + 1} of {steps.length}
                </>
              ) : (
                <>
                  Step {step + 1} of {steps.length}
                </>
              )}
              {hasTourScreen ? " · Live preview" : ""}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={exitTour}
            aria-label="Close tour"
          >
            <X className="size-4" />
          </Button>
        </div>

        <h2
          id="platform-tour-title"
          className="font-sans text-lg font-semibold tracking-tight text-foreground sm:text-xl"
        >
          {def.title}
        </h2>
        <p id="platform-tour-body" className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {def.body}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-5">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            disabled={first}
            onClick={() => goToStep(step - 1)}
          >
            Back
          </Button>
          <div className="flex gap-2">
            {last ? (
              <Button type="button" onClick={exitTour}>
                Done
              </Button>
            ) : (
              <Button type="button" onClick={() => goToStep(step + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
