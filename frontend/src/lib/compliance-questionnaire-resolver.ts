import type {
  ComplianceQuestion,
  AnalysisResult,
  QuestionnaireAnswer,
} from "@/lib/compliance-questionnaire-types";
import { CAYUSE_SECTION_LABELS } from "@/lib/compliance-questionnaire-types";
import type { ComplianceSignals } from "@/lib/compliance-questionnaire-signals";

export function resolveActiveQuestions(
  signals: ComplianceSignals,
  questionBank: readonly ComplianceQuestion[],
): ComplianceQuestion[] {
  return questionBank.filter((question) => {
    if (question.applicableWhen.length === 0) return true;
    return question.applicableWhen.every(
      (predicate) => signals[predicate.signal] === predicate.value,
    );
  });
}

export function buildQuestionContext(
  activeQuestions: readonly ComplianceQuestion[],
  analysisResults: readonly AnalysisResult[],
): string {
  const resultsByQuestion = new Map(
    analysisResults.map((result) => [result.questionId, result]),
  );

  const sections = new Map<string, string[]>();

  for (const question of activeQuestions) {
    const result = resultsByQuestion.get(question.questionId);
    if (result?.status === "answered") continue;

    const sectionLabel = CAYUSE_SECTION_LABELS[question.cayuseSection];
    const lines = sections.get(sectionLabel) ?? [];

    let line = `[${question.questionId}] ${question.questionText}`;
    if (result?.status === "partially_answered" && result.clarificationNeeded) {
      line += ` (Partial info found: ${result.clarificationNeeded})`;
    }

    lines.push(line);
    sections.set(sectionLabel, lines);
  }

  const parts: string[] = [];
  for (const [sectionLabel, lines] of sections) {
    parts.push(`### ${sectionLabel}\n${lines.join("\n")}`);
  }

  return parts.join("\n\n");
}

export function answersFromAnalysis(
  analysisResults: readonly AnalysisResult[],
): QuestionnaireAnswer[] {
  return analysisResults
    .filter(
      (result): result is AnalysisResult & { extractedAnswer: string } =>
        result.status === "answered" && result.extractedAnswer !== null,
    )
    .map((result) => ({
      questionId: result.questionId,
      answerText: result.extractedAnswer,
      answeredBy: "document_extraction" as const,
      confidence: result.confidence,
    }));
}

export function countAnsweredBySection(
  activeQuestions: readonly ComplianceQuestion[],
  answers: readonly QuestionnaireAnswer[],
): Map<string, { total: number; answered: number }> {
  const answeredIds = new Set(answers.map((answer) => answer.questionId));
  const counts = new Map<string, { total: number; answered: number }>();

  for (const question of activeQuestions) {
    const section = question.cayuseSection;
    const existing = counts.get(section) ?? { total: 0, answered: 0 };
    existing.total += 1;
    if (answeredIds.has(question.questionId)) {
      existing.answered += 1;
    }
    counts.set(section, existing);
  }

  return counts;
}
