import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { generateWithForcedToolCall } from "@/lib/server/gemini";
import { buildAdminSummaryContext } from "@/lib/admin-summary-context";
import type {
  SimulatedReviewerAssessment,
  SimulatedReviewerRole,
  SimulatedBoardSynthesis,
  SimulatedBoardReviewResult,
} from "@/lib/simulated-board-review-types";

const REVIEW_DECISIONS = [
  "approve",
  "minor_modifications",
  "revisions_required",
  "reject",
  "table",
] as const;

const reviewerAssessmentDeclaration: FunctionDeclaration = {
  name: "reviewer_assessment",
  description: "Structured IRB reviewer assessment of a research proposal",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      decision: {
        type: SchemaType.STRING,
        format: "enum",
        enum: [...REVIEW_DECISIONS],
      },
      confidence: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["high", "medium", "low"],
      },
      key_findings: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: "3-6 key observations about the proposal from your review perspective",
      },
      concerns: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: "Specific concerns that need addressing; empty array if none",
      },
      conditions: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: "Conditions for approval, if applicable; empty array if unconditional",
      },
      narrative: {
        type: SchemaType.STRING,
        description: "2-3 paragraph assessment from your review perspective",
      },
    },
    required: ["decision", "confidence", "key_findings", "concerns", "conditions", "narrative"],
  },
};

const boardSynthesisDeclaration: FunctionDeclaration = {
  name: "board_synthesis",
  description: "Synthesized IRB board recommendation from multiple reviewer assessments",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      board_decision: {
        type: SchemaType.STRING,
        format: "enum",
        enum: [...REVIEW_DECISIONS],
      },
      vote_summary: {
        type: SchemaType.STRING,
        description: "Brief summary of how reviewers voted, e.g. '2-1 in favor of approval with modifications'",
      },
      dissenting_views: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: "Points where reviewers disagreed; empty array if unanimous",
      },
      required_modifications: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: "Changes required before approval; empty array if approved as-is",
      },
      recommended_conditions: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: "Ongoing conditions attached to approval",
      },
      rationale: {
        type: SchemaType.STRING,
        description: "3-4 paragraph rationale explaining the board decision and how individual assessments were weighed",
      },
    },
    required: [
      "board_decision",
      "vote_summary",
      "dissenting_views",
      "required_modifications",
      "recommended_conditions",
      "rationale",
    ],
  },
};

function primaryReviewerSystem(institutionGuidance: string): string {
  return `You are the PRIMARY REVIEWER on a simulated IRB board. Your focus is scientific merit and methodology.

Evaluate:
- Whether the study design is appropriate for the stated objectives
- Statistical approach and sample size justification
- Feasibility of the proposed procedures and timeline
- Quality and completeness of the methodology description
- Whether the background and rationale adequately support the proposed work

Ground your assessment in the specific details of the protocol. Cite section names when referencing specific content. Be constructive but rigorous — flag genuine methodological weaknesses, not stylistic preferences.

Do NOT use markdown bold or italic formatting in your output.${institutionGuidance}`;
}

function ethicsReviewerSystem(institutionGuidance: string): string {
  return `You are the ETHICS REVIEWER on a simulated IRB board. Your focus is participant protections and ethical conduct.

Evaluate:
- Adequacy of the informed consent process and document
- Whether the risk-benefit ratio is acceptable
- Whether participant selection is equitable and non-coercive
- Privacy and confidentiality protections for collected data
- Special protections needed for vulnerable populations (children, prisoners, pregnant women, cognitively impaired)
- Whether compensation creates undue influence

Ground your assessment in specific consent language and protocol details. Reference 45 CFR 46 principles where relevant. Focus on substantive ethical issues, not formatting.

Do NOT use markdown bold or italic formatting in your output.${institutionGuidance}`;
}

function regulatoryReviewerSystem(institutionGuidance: string): string {
  return `You are the REGULATORY SPECIALIST on a simulated IRB board. Your focus is regulatory compliance and review category.

Evaluate:
- Correct review category under 45 CFR 46 (exempt categories 1-8, expedited categories 1-9, or full board)
- Whether the protocol meets all regulatory requirements for the proposed category
- Completeness of required elements (consent, data management plan, recruitment materials)
- Compliance with applicable subparts (B for pregnant women, C for prisoners, D for children)
- Whether the predicted review category from the AI intake is accurate
- Any regulatory gaps or missing documentation

Work through the category determination systematically: check full board disqualifiers first, then evaluate exempt categories, then expedited. Do NOT default to expedited category 7 — most behavioral research qualifies as exempt under categories 2 or 3.

Do NOT use markdown bold or italic formatting in your output.${institutionGuidance}`;
}

function boardChairSystem(institutionGuidance: string): string {
  return `You are the IRB BOARD CHAIR synthesizing three independent reviewer assessments into a board recommendation.

Your role:
- Where reviewers agree, state the consensus clearly
- Where reviewers disagree, explain the competing perspectives and how you weigh them
- Apply the most protective standard when reviewers disagree on risk level
- Ensure the final decision reflects the collective assessment, not just a majority vote
- List specific modifications or conditions that emerged from the reviews

The board decision should be the most appropriate outcome given all three assessments. If any reviewer identified a serious concern, it should be addressed in the required modifications even if other reviewers did not flag it.

Do NOT use markdown bold or italic formatting in your output.${institutionGuidance}`;
}

async function runReviewerAssessment(
  role: SimulatedReviewerRole,
  systemInstruction: string,
  contextJson: string,
): Promise<SimulatedReviewerAssessment> {
  const roleLabels: Record<SimulatedReviewerRole, string> = {
    primary: "Primary Reviewer (Scientific Merit & Methodology)",
    ethics: "Ethics Reviewer (Participant Protections)",
    regulatory: "Regulatory Specialist (Compliance & Category)",
  };

  const userText = `You are the ${roleLabels[role]} on this IRB board. Review the following proposal and provide your structured assessment.

${contextJson}`;

  const result = await generateWithForcedToolCall<Omit<SimulatedReviewerAssessment, "role">>({
    systemInstruction,
    history: [],
    userText,
    declaration: reviewerAssessmentDeclaration,
    toolName: "reviewer_assessment",
    maxOutputTokens: 4096,
  });

  return {
    role,
    decision: REVIEW_DECISIONS.includes(result.decision as typeof REVIEW_DECISIONS[number])
      ? result.decision
      : "revisions_required",
    confidence: result.confidence === "high" || result.confidence === "medium" || result.confidence === "low"
      ? result.confidence
      : "medium",
    key_findings: Array.isArray(result.key_findings) ? result.key_findings : [],
    concerns: Array.isArray(result.concerns) ? result.concerns : [],
    conditions: Array.isArray(result.conditions) ? result.conditions : [],
    narrative: typeof result.narrative === "string" ? result.narrative : "",
  };
}

async function synthesizeBoard(
  assessments: readonly SimulatedReviewerAssessment[],
  institutionGuidance: string,
): Promise<SimulatedBoardSynthesis> {
  const assessmentSummaries = assessments
    .map((assessment) => `## ${assessment.role.toUpperCase()} REVIEWER
Decision: ${assessment.decision}
Confidence: ${assessment.confidence}
Key findings: ${assessment.key_findings.join("; ")}
Concerns: ${assessment.concerns.length > 0 ? assessment.concerns.join("; ") : "None"}
Conditions: ${assessment.conditions.length > 0 ? assessment.conditions.join("; ") : "None"}
Narrative: ${assessment.narrative}`)
    .join("\n\n");

  const userText = `Synthesize the following three independent reviewer assessments into a board recommendation.

${assessmentSummaries}`;

  const result = await generateWithForcedToolCall<SimulatedBoardSynthesis>({
    systemInstruction: boardChairSystem(institutionGuidance),
    history: [],
    userText,
    declaration: boardSynthesisDeclaration,
    toolName: "board_synthesis",
    maxOutputTokens: 4096,
  });

  return {
    board_decision: REVIEW_DECISIONS.includes(result.board_decision as typeof REVIEW_DECISIONS[number])
      ? result.board_decision
      : "revisions_required",
    vote_summary: typeof result.vote_summary === "string" ? result.vote_summary : "",
    dissenting_views: Array.isArray(result.dissenting_views) ? result.dissenting_views : [],
    required_modifications: Array.isArray(result.required_modifications) ? result.required_modifications : [],
    recommended_conditions: Array.isArray(result.recommended_conditions) ? result.recommended_conditions : [],
    rationale: typeof result.rationale === "string" ? result.rationale : "",
  };
}

export async function simulateBoardReview(params: {
  title: string;
  formData: Record<string, unknown> | null;
  documentFileNames: string[];
  institutionGuidance: string;
}): Promise<SimulatedBoardReviewResult> {
  const contextJson = buildAdminSummaryContext(params.title, params.formData, {
    documentFileNames: params.documentFileNames,
  });

  const assessments = await Promise.all([
    runReviewerAssessment("primary", primaryReviewerSystem(params.institutionGuidance), contextJson),
    runReviewerAssessment("ethics", ethicsReviewerSystem(params.institutionGuidance), contextJson),
    runReviewerAssessment("regulatory", regulatoryReviewerSystem(params.institutionGuidance), contextJson),
  ]);

  const synthesis = await synthesizeBoard(assessments, params.institutionGuidance);

  return {
    reviewer_assessments: assessments,
    synthesis,
    model_used: process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview",
    completed_at: new Date().toISOString(),
  };
}
