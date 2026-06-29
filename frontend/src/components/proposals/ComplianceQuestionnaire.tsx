"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Send,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  AiChatMessage,
  AiWorkspaceState,
} from "@/lib/ai-proposal-types";
import type {
  AnalysisResult,
  ComplianceQuestion,
  ComplianceQuestionnaireState,
  QuestionnaireAnswer,
} from "@/lib/compliance-questionnaire-types";
import {
  CAYUSE_SECTIONS,
  CAYUSE_SECTION_LABELS,
  emptyQuestionnaireState,
} from "@/lib/compliance-questionnaire-types";
import { COMPLIANCE_QUESTION_BANK } from "@/lib/compliance-question-bank";
import { extractComplianceSignals } from "@/lib/compliance-questionnaire-signals";
import { resolveActiveQuestions } from "@/lib/compliance-questionnaire-resolver";
import { QuestionnaireProgress } from "./QuestionnaireProgress";

type Props = {
  workspace: AiWorkspaceState;
  onUpdate: (next: ComplianceQuestionnaireState) => void;
  onContinueToSubmission?: () => void;
};

function useAutoScroll(
  deps: readonly unknown[],
): [React.RefObject<HTMLDivElement | null>, React.RefObject<HTMLDivElement | null>] {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const scroll = () =>
      element.scrollTo({ top: element.scrollHeight, behavior: "auto" });
    scroll();
    let frame1 = 0;
    let frame2 = 0;
    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(scroll);
    });
    const inner = contentRef.current;
    const observer =
      inner &&
      new ResizeObserver(() => {
        scroll();
      });
    if (inner && observer) observer.observe(inner);
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [scrollRef, contentRef];
}

function AnalyzingState({ onSkip }: { onSkip: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useLayoutEffect(() => {
    const interval = setInterval(() => setElapsed((previous) => previous + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <h3 className="text-base font-semibold">
          Analyzing your submission materials
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Reviewing uploaded documents against IRB compliance requirements to
          identify which questions are already answered.
        </p>
        {elapsed > 5 && (
          <p className="text-xs tabular-nums text-muted-foreground">
            {elapsed}s elapsed
          </p>
        )}
      </div>
      <div className="w-full max-w-md space-y-3">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded-xl bg-muted/30"
            style={{ animationDelay: `${index * 150}ms` }}
          />
        ))}
      </div>
      {elapsed > 10 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={onSkip}
        >
          <SkipForward className="mr-1.5 h-3.5 w-3.5" />
          Skip analysis — ask all questions
        </Button>
      )}
    </div>
  );
}

function AnalysisReviewState({
  analysisResults,
  activeQuestions,
  onBeginChat,
}: {
  analysisResults: readonly AnalysisResult[];
  activeQuestions: ReturnType<typeof COMPLIANCE_QUESTION_BANK.filter>;
  answers: readonly QuestionnaireAnswer[];
  onBeginChat: () => void;
}) {
  const answeredCount = analysisResults.filter(
    (result) => result.status === "answered",
  ).length;
  const totalCount = activeQuestions.length;
  const remainingCount = totalCount - answeredCount;

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-hidden">
      <div className="shrink-0 space-y-1 px-4 pt-4 md:px-6 md:pt-6">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <h3 className="text-base font-semibold">Analysis complete</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{answeredCount}</span>{" "}
          of {totalCount} questions answered from your documents &middot;{" "}
          <span className="font-medium text-foreground">{remainingCount}</span>{" "}
          remaining
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 md:px-6">
        <div className="space-y-2">
          {CAYUSE_SECTIONS.map((section) => {
            const sectionQuestions = activeQuestions.filter(
              (question) => question.cayuseSection === section,
            );
            if (sectionQuestions.length === 0) return null;

            const sectionResults = analysisResults.filter((result) =>
              sectionQuestions.some(
                (question) => question.questionId === result.questionId,
              ),
            );
            const sectionAnswered = sectionResults.filter(
              (result) => result.status === "answered",
            ).length;

            return (
              <details
                key={section}
                className="group rounded-lg bg-background/70 px-4 py-3 open:bg-background"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                    <span className="text-sm font-medium">
                      {CAYUSE_SECTION_LABELS[section]}
                    </span>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {sectionAnswered}/{sectionQuestions.length}
                  </span>
                </summary>
                <div className="mt-3 space-y-2 pl-5">
                  {sectionQuestions.map((question) => {
                    const result = sectionResults.find(
                      (analysisResult) =>
                        analysisResult.questionId === question.questionId,
                    );
                    const isAnswered = result?.status === "answered";
                    return (
                      <div
                        key={question.questionId}
                        className="flex items-start justify-between gap-3 rounded-md border border-border/40 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.65rem] font-mono text-muted-foreground">
                              {question.questionId}
                            </span>
                            <span className="truncate text-xs text-foreground">
                              {question.questionText.slice(0, 80)}
                              {question.questionText.length > 80 ? "…" : ""}
                            </span>
                          </div>
                          {isAnswered && result.extractedAnswer && (
                            <p className="mt-1 truncate text-[0.7rem] text-muted-foreground">
                              &ldquo;{result.extractedAnswer.slice(0, 100)}
                              {result.extractedAnswer.length > 100
                                ? "…"
                                : ""}
                              &rdquo;
                            </p>
                          )}
                        </div>
                        {isAnswered ? (
                          <Badge
                            className="shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          >
                            Extracted
                          </Badge>
                        ) : result?.status === "partially_answered" ? (
                          <Badge className="shrink-0 bg-amber-500/10 text-amber-700">
                            Partial
                          </Badge>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 md:px-6 md:pb-6">
        <Button onClick={onBeginChat} className="shadow-sm">
          Begin questionnaire
        </Button>
      </div>
    </div>
  );
}

function QuickAnswerButtons({
  question,
  onSelect,
  disabled,
}: {
  question: ComplianceQuestion;
  onSelect: (answer: string) => void;
  disabled: boolean;
}) {
  if (question.answerType === "yes_no") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mr-auto flex max-w-[85%] gap-2"
      >
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-emerald-500/30 bg-emerald-500/5 px-5 text-emerald-700 shadow-sm hover:bg-emerald-500/15 dark:text-emerald-300"
          disabled={disabled}
          onClick={() => onSelect("Yes")}
        >
          Yes
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-rose-500/30 bg-rose-500/5 px-5 text-rose-700 shadow-sm hover:bg-rose-500/15 dark:text-rose-300"
          disabled={disabled}
          onClick={() => onSelect("No")}
        >
          No
        </Button>
      </motion.div>
    );
  }

  if (question.answerType === "select" && question.selectOptions?.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mr-auto flex max-w-[85%] flex-wrap gap-2"
      >
        {question.selectOptions.map((option) => (
          <Button
            key={option}
            variant="outline"
            size="sm"
            className="rounded-full border-primary/20 bg-primary/5 px-4 text-foreground shadow-sm hover:bg-primary/15"
            disabled={disabled}
            onClick={() => onSelect(option)}
          >
            {option}
          </Button>
        ))}
      </motion.div>
    );
  }

  return null;
}

function ChatState({
  state,
  activeQuestions,
  currentQuestion,
  busy,
  chatInput,
  onInputChange,
  onSend,
  onQuickAnswer,
  onSkipRemaining,
}: {
  state: ComplianceQuestionnaireState;
  activeQuestions: ReturnType<typeof COMPLIANCE_QUESTION_BANK.filter>;
  currentQuestion: ComplianceQuestion | undefined;
  busy: boolean;
  chatInput: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onQuickAnswer: (answer: string) => void;
  onSkipRemaining: () => void;
}) {
  const [scrollRef, contentRef] = useAutoScroll([state.messages, busy]);

  const lastMessage = state.messages[state.messages.length - 1];
  const showQuickAnswers =
    !busy &&
    lastMessage?.role === "assistant" &&
    currentQuestion &&
    currentQuestion.answerType !== "text";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/40 px-4 py-3">
        <QuestionnaireProgress
          activeQuestions={activeQuestions}
          answers={state.answers}
          variant="strip"
        />
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div ref={contentRef} className="space-y-3 p-4 md:p-6">
          <AnimatePresence initial={false}>
            {state.messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  message.role === "user"
                    ? "ml-auto bg-primary/10 text-foreground"
                    : "mr-auto border border-border/40 bg-card text-foreground shadow-sm",
                )}
              >
                {message.content}
              </motion.div>
            ))}
          </AnimatePresence>
          {showQuickAnswers && (
            <QuickAnswerButtons
              question={currentQuestion}
              onSelect={onQuickAnswer}
              disabled={busy}
            />
          )}
          {busy && (
            <div className="mr-auto flex max-w-[85%] items-center gap-2 rounded-2xl border border-border/40 bg-card px-4 py-2.5 text-sm shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Thinking…</span>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/40 bg-background px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={chatInput}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={showQuickAnswers ? "Or type a custom answer…" : "Type your answer…"}
            disabled={busy}
            rows={1}
            className="min-h-10 max-h-28 flex-1 resize-none overflow-auto rounded-lg border border-border/50 bg-background px-3 py-2.5 text-sm leading-relaxed shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
          />
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 shrink-0 rounded-lg shadow-sm"
            disabled={busy || !chatInput.trim()}
            onClick={onSend}
            aria-label="Send"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[0.65rem] text-muted-foreground">
            Press <span className="font-medium">Enter</span> to send,{" "}
            <span className="font-medium">Shift+Enter</span> for new line
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[0.65rem] text-muted-foreground"
            onClick={onSkipRemaining}
            disabled={busy}
          >
            <SkipForward className="mr-1 h-3 w-3" />
            Skip remaining
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompleteState({
  state,
  activeQuestions,
  onResume,
  onContinueToSubmission,
}: {
  state: ComplianceQuestionnaireState;
  activeQuestions: ReturnType<typeof COMPLIANCE_QUESTION_BANK.filter>;
  onResume: () => void;
  onContinueToSubmission?: () => void;
}) {
  const answeredIds = new Set(
    state.answers.map((answer) => answer.questionId),
  );
  const skippedIds = new Set(state.skippedQuestionIds);
  const unansweredCount = activeQuestions.filter(
    (question) =>
      !answeredIds.has(question.questionId) &&
      !skippedIds.has(question.questionId),
  ).length;
  const skippedCount = state.skippedQuestionIds.length;
  const allResolved = unansweredCount === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2 px-4 pt-4 md:px-6 md:pt-6">
        <div className="flex items-center gap-2">
          {allResolved ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <Loader2 className="h-5 w-5 text-primary" />
          )}
          <h3 className="text-base font-semibold">
            {allResolved ? "Questionnaire complete" : "Questionnaire in progress"}
          </h3>
        </div>
        <QuestionnaireProgress
          activeQuestions={activeQuestions}
          answers={state.answers}
          variant="strip"
        />
      </div>

      <div className="px-4 md:px-6">
        <div className="space-y-2">
          {CAYUSE_SECTIONS.map((section) => {
            const sectionQuestions = activeQuestions.filter(
              (question) => question.cayuseSection === section,
            );
            if (sectionQuestions.length === 0) return null;

            const sectionAnswers = state.answers.filter((answer) =>
              sectionQuestions.some(
                (question) => question.questionId === answer.questionId,
              ),
            );

            return (
              <details
                key={section}
                className="group rounded-lg bg-background/70 px-4 py-3 open:bg-background"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                    <span className="text-sm font-medium">
                      {CAYUSE_SECTION_LABELS[section]}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {sectionAnswers.length === sectionQuestions.length
                      ? "All answered"
                      : `${sectionAnswers.length}/${sectionQuestions.length}`}
                  </span>
                </summary>
                <div className="mt-3 space-y-2 pl-5">
                  {sectionQuestions.map((question) => {
                    const answer = sectionAnswers.find(
                      (sectionAnswer) =>
                        sectionAnswer.questionId === question.questionId,
                    );
                    return (
                      <div
                        key={question.questionId}
                        className="rounded-md border border-border/40 px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-[0.65rem] font-mono text-muted-foreground">
                              {question.questionId}
                            </span>
                            <p className="text-xs text-foreground">
                              {question.questionText}
                            </p>
                          </div>
                          {answer ? (
                            <Badge
                              className={cn(
                                "shrink-0",
                                answer.answeredBy === "document_extraction"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : "bg-secondary text-secondary-foreground",
                              )}
                            >
                              {answer.answeredBy === "document_extraction"
                                ? "Extracted"
                                : "Your answer"}
                            </Badge>
                          ) : (
                            <Badge className="shrink-0 bg-amber-500/10 text-amber-700">
                              Skipped
                            </Badge>
                          )}
                        </div>
                        {answer && (
                          <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
                            {answer.answerText}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      {skippedCount > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 mx-4 md:mx-6">
          <p className="text-xs font-medium text-amber-700">
            {skippedCount} question{skippedCount !== 1 ? "s" : ""} skipped —
            reviewers will be notified.
          </p>
        </div>
      )}

      {unansweredCount > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 mx-4 md:mx-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-foreground">
              {unansweredCount} question{unansweredCount !== 1 ? "s" : ""} still
              unanswered
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs shadow-sm"
              onClick={onResume}
            >
              Resume questionnaire
            </Button>
          </div>
        </div>
      )}

      <div className="px-4 pb-4 md:px-6 md:pb-6">
        {allResolved && onContinueToSubmission ? (
          <Button
            onClick={onContinueToSubmission}
            className="w-fit shadow-sm"
          >
            Continue to submission →
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ComplianceQuestionnaire({ workspace, onUpdate, onContinueToSubmission }: Props) {
  const state = workspace.compliance_questionnaire ?? emptyQuestionnaireState();
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [skipConfirming, setSkipConfirming] = useState(false);
  const [analyzing, setAnalyzing] = useState(
    state.status === "not_started" || state.status === "analyzing",
  );
  const analysisStarted = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const activeQuestions = COMPLIANCE_QUESTION_BANK.filter((question) =>
    state.activeQuestionIds.includes(question.questionId),
  );

  useEffect(() => {
    if (!analyzing) return;
    if (analysisStarted.current) return;
    analysisStarted.current = true;

    fetch("/api/prototype/ai-intake/questionnaire/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: workspaceRef.current }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Analysis failed");
        return response.json();
      })
      .then((analysisData: { results: AnalysisResult[]; summary: string; activeQuestionIds: string[] }) => {
        const extractedAnswers: QuestionnaireAnswer[] = analysisData.results
          .filter((result) => result.status === "answered" && result.extractedAnswer)
          .map((result) => ({
            questionId: result.questionId,
            answerText: result.extractedAnswer ?? "",
            answeredBy: "document_extraction" as const,
            confidence: result.confidence,
          }));
        setAnalyzing(false);
        onUpdateRef.current({
          status: "in_progress",
          analysisResults: analysisData.results,
          messages: [],
          answers: extractedAnswers,
          activeQuestionIds: analysisData.activeQuestionIds,
          skippedQuestionIds: [],
        });
      })
      .catch(() => {
        const currentWorkspace = workspaceRef.current;
        const signals = extractComplianceSignals(
          currentWorkspace.protocol,
          currentWorkspace.compliance_flags,
          currentWorkspace.predicted_category,
          currentWorkspace.context_notes,
        );
        const fallbackQuestions = resolveActiveQuestions(signals, COMPLIANCE_QUESTION_BANK);
        setAnalyzing(false);
        onUpdateRef.current({
          status: "in_progress",
          analysisResults: [],
          messages: [],
          answers: [],
          activeQuestionIds: fallbackQuestions.map((question) => question.questionId),
          skippedQuestionIds: [],
        });
      });
  }, [analyzing]);

  const answeredIds = new Set(
    state.answers.map((answer) => answer.questionId),
  );
  const currentQuestion = COMPLIANCE_QUESTION_BANK.find(
    (question) =>
      state.activeQuestionIds.includes(question.questionId) &&
      !answeredIds.has(question.questionId),
  );

  const doSend = useCallback(async (text: string) => {
    if (!text || busy) return;

    setBusy(true);
    setChatInput("");

    const userMsg: AiChatMessage = { role: "user", content: text };
    const pendingMessages: AiChatMessage[] = [...state.messages, userMsg];
    onUpdate({ ...state, messages: pendingMessages });

    try {
      const response = await fetch(
        "/api/prototype/ai-intake/questionnaire",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: state.messages,
            user_message: text,
            analysis_results: state.analysisResults,
            existing_answers: state.answers,
            active_question_ids: state.activeQuestionIds,
          }),
        },
      );

      if (!response.ok) throw new Error("Questionnaire request failed");
      const data = (await response.json()) as {
        assistant_message: string;
        new_answers?: QuestionnaireAnswer[];
        questionnaire_complete?: boolean;
      };

      const mergedAnswers = [...state.answers];
      for (const newAnswer of data.new_answers ?? []) {
        const existingIndex = mergedAnswers.findIndex(
          (existing) => existing.questionId === newAnswer.questionId,
        );
        if (existingIndex >= 0) {
          mergedAnswers[existingIndex] = newAnswer;
        } else {
          mergedAnswers.push(newAnswer);
        }
      }

      onUpdate({
        ...state,
        status: data.questionnaire_complete ? "complete" : "in_progress",
        messages: [
          ...pendingMessages,
          { role: "assistant", content: data.assistant_message },
        ],
        answers: mergedAnswers,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong";
      onUpdate({
        ...state,
        messages: [
          ...pendingMessages,
          { role: "assistant", content: `Something went wrong: ${errorMessage}. Please try again.` },
        ],
      });
    } finally {
      setBusy(false);
    }
  }, [busy, state, onUpdate]);

  const sendMessage = useCallback(() => {
    const trimmed = chatInput.trim();
    if (trimmed) doSend(trimmed);
  }, [chatInput, doSend]);

  const sendQuickAnswer = useCallback((answer: string) => {
    doSend(answer);
  }, [doSend]);

  const handleBeginChat = useCallback(() => {
    const unansweredQuestions = COMPLIANCE_QUESTION_BANK.filter(
      (question) =>
        state.activeQuestionIds.includes(question.questionId) &&
        !state.answers.some((answer) => answer.questionId === question.questionId),
    );
    const firstQuestion = unansweredQuestions[0];
    const greeting = firstQuestion
      ? `Let's go through the remaining compliance questions. First up:\n\n${firstQuestion.questionText}`
      : "It looks like all questions have been answered from your documents. You're all set!";

    onUpdate({
      ...state,
      status: "in_progress",
      messages: [
        { role: "assistant", content: greeting },
      ],
    });
  }, [state, onUpdate]);

  const handleSkipRemaining = useCallback(() => {
    if (!skipConfirming) {
      setSkipConfirming(true);
      return;
    }

    const answeredIds = new Set(
      state.answers.map((answer) => answer.questionId),
    );
    const skippedIds = state.activeQuestionIds.filter(
      (questionId) => !answeredIds.has(questionId),
    );

    onUpdate({
      ...state,
      status: "complete",
      skippedQuestionIds: skippedIds,
    });
    setSkipConfirming(false);
  }, [skipConfirming, state, onUpdate]);

  const handleResume = useCallback(() => {
    const unansweredQuestions = COMPLIANCE_QUESTION_BANK.filter(
      (question) =>
        state.activeQuestionIds.includes(question.questionId) &&
        !state.answers.some((answer) => answer.questionId === question.questionId),
    );
    const nextQuestion = unansweredQuestions[0];
    const resumeGreeting = nextQuestion
      ? `Let's continue. Next question:\n\n${nextQuestion.questionText}`
      : "All questions have been answered!";

    onUpdate({
      ...state,
      status: "in_progress",
      skippedQuestionIds: [],
      messages: [
        ...state.messages,
        { role: "assistant", content: resumeGreeting },
      ],
    });
  }, [state, onUpdate]);

  const handleSkipAnalysis = useCallback(() => {
    const allQuestionIds = COMPLIANCE_QUESTION_BANK.map(
      (question) => question.questionId,
    );
    setAnalyzing(false);
    onUpdate({
      ...state,
      status: "in_progress",
      analysisResults: [],
      answers: [],
      activeQuestionIds: allQuestionIds,
      skippedQuestionIds: [],
    });
  }, [state, onUpdate]);

  if (analyzing) {
    return <AnalyzingState onSkip={handleSkipAnalysis} />;
  }

  if (state.status === "in_progress" && state.messages.length === 0) {
    return (
      <AnalysisReviewState
        analysisResults={state.analysisResults}
        activeQuestions={activeQuestions}
        answers={state.answers}
        onBeginChat={handleBeginChat}
      />
    );
  }

  if (state.status === "complete") {
    return (
      <CompleteState
        state={state}
        activeQuestions={activeQuestions}
        onResume={handleResume}
        onContinueToSubmission={onContinueToSubmission}
      />
    );
  }

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-[400px] flex-col overflow-hidden rounded-xl border border-border/40">
      <ChatState
        state={state}
        activeQuestions={activeQuestions}
        currentQuestion={currentQuestion}
        busy={busy}
        chatInput={chatInput}
        onInputChange={setChatInput}
        onSend={sendMessage}
        onQuickAnswer={sendQuickAnswer}
        onSkipRemaining={handleSkipRemaining}
      />
      {skipConfirming && (
        <div className="shrink-0 border-t border-border/60 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-amber-700">
              Skip remaining questions? Reviewers will see unanswered items.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSkipConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSkipRemaining}
              >
                Skip
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
