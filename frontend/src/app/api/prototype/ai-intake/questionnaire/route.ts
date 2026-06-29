import { NextResponse } from "next/server";
import {
  generateWithForcedToolCall,
  type ToolDefinition,
} from "@/lib/server/ai";
import type { AiChatMessage } from "@/lib/ai-proposal-types";
import type {
  AnalysisResult,
  QuestionnaireAnswer,
} from "@/lib/compliance-questionnaire-types";
import { COMPLIANCE_QUESTION_BANK } from "@/lib/compliance-question-bank";
import { buildQuestionContext } from "@/lib/compliance-questionnaire-resolver";

const QUESTIONNAIRE_CHAT_SYSTEM = `You are helping a researcher complete their IRB submission by asking targeted compliance questions. You have a list of specific Cayuse IRB questions that still need answers.

## Behavior

1. Ask exactly ONE question per turn. Keep it short and direct.
2. Accept natural language answers. Extract the structured answer from the researcher's response.
3. When a question has regulatory context that might be confusing, add a brief parenthetical explanation.
4. If the researcher's answer is ambiguous or incomplete, ask a brief clarifying follow-up before moving on.
5. When all questions are answered (remaining count reaches 0), let the researcher know they are done. Do NOT declare the questionnaire complete if any questions remain unanswered — check the remaining count at the bottom of the prompt.

## Tone

Professional but approachable. Plain language. Brief. You are helping them complete a requirement efficiently, not interrogating them.

## Rules

- Do not provide legal advice or make regulatory determinations.
- Do not suggest changing the study design to avoid requirements.
- Do not skip required questions because the study seems low-risk.
- Do not ask for document uploads — the platform handles that separately.
- Keep your responses under 3 sentences.`;

const questionnaireUpdateTool: ToolDefinition = {
  name: "questionnaire_update",
  description:
    "Your conversational reply and any newly answered compliance questions.",
  parameters: {
    type: "object",
    properties: {
      assistant_reply: {
        type: "string",
        description: "Your short message to the researcher (1-3 sentences max)",
      },
      new_answers: {
        type: "array",
        description: "Questions answered by the researcher in this turn",
        items: {
          type: "object",
          properties: {
            questionId: { type: "string" },
            answerText: { type: "string" },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
          },
          required: ["questionId", "answerText", "confidence"],
        },
      },
      questionnaire_complete: {
        type: "boolean",
        description:
          "True when all active questions are answered or the researcher has indicated they are done",
      },
    },
    required: ["assistant_reply", "new_answers", "questionnaire_complete"],
  },
};

type RequestBody = {
  messages: AiChatMessage[];
  user_message: string;
  analysis_results: AnalysisResult[];
  existing_answers: QuestionnaireAnswer[];
  active_question_ids: string[];
};

function buildSystemPrompt(
  analysisResults: readonly AnalysisResult[],
  existingAnswers: readonly QuestionnaireAnswer[],
  activeQuestionIds: readonly string[],
): string {
  const activeQuestions = COMPLIANCE_QUESTION_BANK.filter((question) =>
    activeQuestionIds.includes(question.questionId),
  );
  const unansweredContext = buildQuestionContext(
    activeQuestions,
    analysisResults,
  );

  const answeredSummary = existingAnswers
    .map(
      (answer) =>
        `[${answer.questionId}] ${answer.answerText} (${answer.answeredBy})`,
    )
    .join("\n");

  const parts = [QUESTIONNAIRE_CHAT_SYSTEM];
  if (answeredSummary) {
    parts.push(`\n## Already Answered\n${answeredSummary}`);
  }
  parts.push(`\n## Questions Still Needed\n${unansweredContext}`);
  parts.push(
    `\nTotal active: ${activeQuestionIds.length}. Already answered: ${existingAnswers.length}. Remaining: ${activeQuestionIds.length - existingAnswers.length}.`,
  );

  return parts.join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const userMessage = String(body.user_message ?? "").trim();
    if (!userMessage) {
      return NextResponse.json(
        { error: "user_message required" },
        { status: 400 },
      );
    }

    const prior: AiChatMessage[] = body.messages ?? [];
    const analysisResults = body.analysis_results ?? [];
    const existingAnswers = body.existing_answers ?? [];
    const activeQuestionIds = body.active_question_ids ?? [];

    const systemInstruction = buildSystemPrompt(
      analysisResults,
      existingAnswers,
      activeQuestionIds,
    );

    const toolOutput = await generateWithForcedToolCall<{
      assistant_reply: string;
      new_answers: Array<{
        questionId: string;
        answerText: string;
        confidence: "high" | "medium" | "low";
      }>;
      questionnaire_complete: boolean;
    }>("questionnaire-chat", {
      systemInstruction,
      history: prior,
      userText: userMessage,
      tool: questionnaireUpdateTool,
    });

    const formattedAnswers: QuestionnaireAnswer[] =
      toolOutput.new_answers.map((answer) => ({
        questionId: answer.questionId,
        answerText: answer.answerText,
        answeredBy: "pi_response" as const,
        confidence: answer.confidence,
      }));

    const allAnsweredIds = new Set([
      ...existingAnswers.map((answer) => answer.questionId),
      ...formattedAnswers.map((answer) => answer.questionId),
    ]);
    const actualRemaining = activeQuestionIds.filter(
      (questionId) => !allAnsweredIds.has(questionId),
    ).length;
    const isActuallyComplete =
      toolOutput.questionnaire_complete && actualRemaining === 0;

    return NextResponse.json({
      assistant_message: toolOutput.assistant_reply,
      new_answers: formattedAnswers,
      questionnaire_complete: isActuallyComplete,
    });
  } catch (error) {
    console.error("Questionnaire chat failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Questionnaire chat failed",
      },
      { status: 500 },
    );
  }
}
