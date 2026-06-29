import { NextResponse } from "next/server";
import { generateWithForcedToolCall, resolveProviderForTask, type ToolDefinition } from "@/lib/server/ai";
import type { AiWorkspaceState } from "@/lib/ai-proposal-types";
import type { AnalysisResult, ComplianceQuestion } from "@/lib/compliance-questionnaire-types";
import { CAYUSE_SECTION_LABELS, type CayuseSection } from "@/lib/compliance-questionnaire-types";
import { COMPLIANCE_QUESTION_BANK } from "@/lib/compliance-question-bank";
import { extractComplianceSignals } from "@/lib/compliance-questionnaire-signals";
import { resolveActiveQuestions } from "@/lib/compliance-questionnaire-resolver";

const documentResultTool: ToolDefinition = {
  name: "document_analysis",
  description:
    "Report which compliance questions this document answers.",
  parameters: {
    type: "object",
    properties: {
      results: {
        type: "array",
        description: "Only include questions this document actually answers or partially answers. Omit questions with no relevant info in this document.",
        items: {
          type: "object",
          properties: {
            questionId: { type: "string" },
            status: {
              type: "string",
              enum: ["answered", "partially_answered"],
            },
            extractedAnswer: {
              type: "string",
              description: "The answer extracted from this document. Be concise.",
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
          },
          required: ["questionId", "status", "extractedAnswer", "confidence"],
        },
      },
    },
    required: ["results"],
  },
};

const DOC_TEXT_LIMIT = 15_000;
const PROTOCOL_TEXT_LIMIT = 8_000;

function truncateText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + "\n\n…[truncated]";
}

function formatQuestionHierarchy(questions: readonly ComplianceQuestion[]): string {
  const bySection = new Map<CayuseSection, ComplianceQuestion[]>();
  for (const question of questions) {
    const group = bySection.get(question.cayuseSection) ?? [];
    group.push(question);
    bySection.set(question.cayuseSection, group);
  }

  const sections: string[] = [];
  for (const [section, sectionQuestions] of bySection) {
    const label = CAYUSE_SECTION_LABELS[section];
    const lines: string[] = [`### ${label}`];

    const topLevel = sectionQuestions.filter((question) => !question.branchParentId);
    const children = sectionQuestions.filter((question) => question.branchParentId);

    for (const question of topLevel) {
      lines.push(formatSingleQuestion(question, ""));
      const branches = children.filter((child) => child.branchParentId === question.questionId);
      for (const branch of branches) {
        lines.push(formatSingleQuestion(branch, "  ▶ "));
      }
    }

    const orphanBranches = children.filter(
      (child) => !topLevel.some((parent) => parent.questionId === child.branchParentId),
    );
    for (const branch of orphanBranches) {
      lines.push(formatSingleQuestion(branch, "  ▶ "));
    }

    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n");
}

function formatSingleQuestion(question: ComplianceQuestion, indent: string): string {
  const parts = [`${indent}[${question.questionId}] ${question.questionText}`];

  if (question.answerType === "yes_no") {
    parts.push(`${indent}  Answer type: Yes/No`);
  } else if (question.answerType === "select" && question.selectOptions?.length) {
    parts.push(`${indent}  Answer type: Select from: ${question.selectOptions.join(", ")}`);
  }

  if (question.helpText) {
    parts.push(`${indent}  Hint: ${question.helpText}`);
  }

  if (question.branchParentId) {
    parts.push(`${indent}  (Follow-up to ${question.branchParentId})`);
  }

  return parts.join("\n");
}

function buildDocumentPrompt(
  documentName: string,
  documentText: string,
  questionHierarchy: string,
  category: string,
): string {
  return [
    `You are reviewing the document "${documentName}" to find answers to IRB compliance questions.`,
    `Review category: ${category}`,
    "",
    "Only report questions that THIS document contains information about. Skip questions with no relevant content.",
    "Questions marked with ▶ are follow-ups that only apply if the parent question's answer triggers them.\n",
    "## Compliance Questions\n",
    questionHierarchy,
    "\n## Document Content\n",
    truncateText(documentText, DOC_TEXT_LIMIT),
  ].join("\n");
}

function buildProtocolPrompt(
  protocol: Record<string, string>,
  questionHierarchy: string,
  category: string,
  complianceFlags: AiWorkspaceState["compliance_flags"],
): string {
  const protocolEntries = Object.entries(protocol)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `### ${key}\n${value}`)
    .join("\n\n");

  const flagsBlock = complianceFlags?.length
    ? `\n## Compliance Flags\n${JSON.stringify(complianceFlags, null, 2)}\n`
    : "";

  return [
    "You are reviewing the extracted protocol sections to find answers to IRB compliance questions.",
    `Review category: ${category}`,
    "",
    "Only report questions the protocol data contains information about. Skip questions with no relevant content.",
    "Questions marked with ▶ are follow-ups that only apply if the parent question's answer triggers them.\n",
    "## Compliance Questions\n",
    questionHierarchy,
    "\n## Protocol Sections\n",
    truncateText(protocolEntries, PROTOCOL_TEXT_LIMIT),
    flagsBlock,
  ].join("\n");
}

type DocumentResult = { questionId: string; status: "answered" | "partially_answered"; extractedAnswer: string; confidence: "high" | "medium" | "low" };

function mergeResults(
  allDocResults: DocumentResult[][],
  allSourceNames: string[],
  activeQuestionIds: string[],
): AnalysisResult[] {
  const bestByQuestion = new Map<string, AnalysisResult>();

  const confidenceRank = { high: 3, medium: 2, low: 1 };
  const statusRank = { answered: 2, partially_answered: 1 };

  for (let documentIndex = 0; documentIndex < allDocResults.length; documentIndex++) {
    const sourceName = allSourceNames[documentIndex];
    for (const result of allDocResults[documentIndex]) {
      const existing = bestByQuestion.get(result.questionId);
      const isBetter = !existing
        || statusRank[result.status] > statusRank[existing.status as "answered" | "partially_answered"]
        || (result.status === existing.status && confidenceRank[result.confidence] > confidenceRank[existing.confidence as "high" | "medium" | "low"]);

      if (isBetter) {
        bestByQuestion.set(result.questionId, {
          questionId: result.questionId,
          status: result.status,
          extractedAnswer: result.extractedAnswer,
          sourceDocument: sourceName,
          confidence: result.confidence,
          clarificationNeeded: "",
        });
      }
    }
  }

  return activeQuestionIds.map((questionId) =>
    bestByQuestion.get(questionId) ?? {
      questionId,
      status: "unanswered",
      extractedAnswer: "",
      sourceDocument: "",
      confidence: "low",
      clarificationNeeded: "",
    },
  );
}

export async function POST(request: Request) {
  console.log("[questionnaire-analyze] route hit");
  try {
    const body = (await request.json()) as { workspace: AiWorkspaceState };
    const workspace = body.workspace;
    if (!workspace) {
      return NextResponse.json(
        { error: "workspace required" },
        { status: 400 },
      );
    }

    const hasComplianceData = workspace.compliance_flags.length > 0 || workspace.predicted_category !== null;

    const signals = extractComplianceSignals(
      workspace.protocol,
      workspace.compliance_flags,
      workspace.predicted_category,
      workspace.context_notes,
    );

    const activeQuestions = hasComplianceData
      ? resolveActiveQuestions(signals, COMPLIANCE_QUESTION_BANK)
      : [...COMPLIANCE_QUESTION_BANK];

    const questionHierarchy = formatQuestionHierarchy(activeQuestions);

    const category = workspace.predicted_category ?? "unknown";
    const resolvedProvider = await resolveProviderForTask("questionnaire-analyze");
    const systemInstruction =
      "You are an IRB compliance document analyst. Find answers to compliance questions in the provided material. Be concise. Only report questions you find answers for. Pay attention to the question hierarchy — ▶ follow-up questions only apply when their parent triggers them.";

    const documents = workspace.context_attachments.filter(
      (attachment) => attachment.text?.trim(),
    );

    const agentCount = documents.length + 1;
    console.log(
      `[questionnaire-analyze] provider=${resolvedProvider}, ${activeQuestions.length} questions, ${agentCount} parallel agents (${documents.length} docs + protocol)`,
    );
    const startTime = Date.now();

    const protocolPromise = generateWithForcedToolCall<{ results: DocumentResult[] }>(
      "questionnaire-analyze",
      {
        systemInstruction,
        history: [],
        userText: buildProtocolPrompt(
          workspace.protocol as Record<string, string>,
          questionHierarchy,
          category,
          workspace.compliance_flags,
        ),
        tool: documentResultTool,
      },
    ).catch((error) => {
      console.error("[questionnaire-analyze] protocol agent failed:", error);
      return { results: [] as DocumentResult[] };
    });

    const documentPromises = documents.map((attachment) => {
      const prompt = buildDocumentPrompt(
        attachment.name,
        attachment.text,
        questionHierarchy,
        category,
      );
      console.log(
        `[questionnaire-analyze]   "${attachment.name}": ${prompt.length} chars`,
      );
      return generateWithForcedToolCall<{ results: DocumentResult[] }>(
        "questionnaire-analyze",
        {
          systemInstruction,
          history: [],
          userText: prompt,
          tool: documentResultTool,
        },
      ).catch((error) => {
        console.error(`[questionnaire-analyze] "${attachment.name}" failed:`, error);
        return { results: [] as DocumentResult[] };
      });
    });

    const allOutputs = await Promise.all([protocolPromise, ...documentPromises]);
    const allDocResults = allOutputs.map((output) => output.results);
    const allSourceNames = ["protocol", ...documents.map((attachment) => attachment.name)];

    const activeQuestionIds = activeQuestions.map((question) => question.questionId);
    const mergedResults = mergeResults(allDocResults, allSourceNames, activeQuestionIds);

    const elapsed = Date.now() - startTime;
    const answeredCount = mergedResults.filter((result) => result.status === "answered").length;
    console.log(
      `[questionnaire-analyze] completed in ${elapsed}ms — ${mergedResults.length} questions, ${answeredCount} answered, ${agentCount} agents`,
    );

    return NextResponse.json({
      results: mergedResults,
      summary: `${answeredCount} of ${mergedResults.length} questions answered from ${agentCount} sources in ${elapsed}ms.`,
      activeQuestionIds,
      signals,
    });
  } catch (error) {
    console.error("Questionnaire analysis failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Questionnaire analysis failed",
      },
      { status: 500 },
    );
  }
}
