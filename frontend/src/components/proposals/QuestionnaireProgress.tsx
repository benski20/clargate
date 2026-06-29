"use client";

import { Check, Circle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionnaireAnswer } from "@/lib/compliance-questionnaire-types";
import {
  CAYUSE_SECTIONS,
  CAYUSE_SECTION_LABELS,
  type CayuseSection,
} from "@/lib/compliance-questionnaire-types";
import type { ComplianceQuestion } from "@/lib/compliance-questionnaire-types";

type SectionStatus = "complete" | "in_progress" | "not_started";

function getSectionStatus(
  section: CayuseSection,
  activeQuestions: readonly ComplianceQuestion[],
  answers: readonly QuestionnaireAnswer[],
): { status: SectionStatus; answered: number; total: number } {
  const sectionQuestions = activeQuestions.filter(
    (question) => question.cayuseSection === section,
  );
  const total = sectionQuestions.length;
  if (total === 0) return { status: "not_started", answered: 0, total: 0 };

  const answeredIds = new Set(answers.map((answer) => answer.questionId));
  const answered = sectionQuestions.filter((question) =>
    answeredIds.has(question.questionId),
  ).length;

  if (answered === total) return { status: "complete", answered, total };
  if (answered > 0) return { status: "in_progress", answered, total };
  return { status: "not_started", answered, total };
}

export function QuestionnaireProgress({
  activeQuestions,
  answers,
  variant = "strip",
}: {
  activeQuestions: readonly ComplianceQuestion[];
  answers: readonly QuestionnaireAnswer[];
  variant?: "strip" | "sidebar";
}) {
  const totalActive = activeQuestions.length;
  const totalAnswered = answers.length;
  const percentage =
    totalActive > 0 ? Math.round((totalAnswered / totalActive) * 100) : 0;

  if (variant === "strip") {
    return (
      <div className="space-y-2.5 rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {totalAnswered} of {totalActive} answered
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {percentage}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CAYUSE_SECTIONS.map((section) => {
            const info = getSectionStatus(section, activeQuestions, answers);
            if (info.total === 0) return null;
            return (
              <span
                key={section}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.65rem] font-medium",
                  info.status === "complete" &&
                    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  info.status === "in_progress" &&
                    "bg-primary/10 text-primary",
                  info.status === "not_started" &&
                    "bg-muted/40 text-muted-foreground",
                )}
              >
                {info.status === "complete" ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                ) : info.status === "in_progress" ? (
                  <CircleDot className="h-2.5 w-2.5" />
                ) : (
                  <Circle className="h-2.5 w-2.5" />
                )}
                {CAYUSE_SECTION_LABELS[section].split(" ")[0]}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {CAYUSE_SECTIONS.map((section) => {
        const info = getSectionStatus(section, activeQuestions, answers);
        if (info.total === 0) return null;
        return (
          <div
            key={section}
            className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              {info.status === "complete" ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
              ) : info.status === "in_progress" ? (
                <CircleDot className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "text-xs font-medium",
                  info.status === "complete"
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {CAYUSE_SECTION_LABELS[section]}
              </span>
            </div>
            <span className="text-[0.65rem] tabular-nums text-muted-foreground">
              {info.answered}/{info.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
