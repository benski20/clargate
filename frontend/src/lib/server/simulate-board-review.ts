import { generateWithForcedToolCall, resolveProviderForTask, type ToolDefinition } from "@/lib/server/ai";
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

/** Shared style for all simulated board outputs shown to admins. */
const CONCISE_OUTPUT_RULES = `
Write for a busy IRB administrator scanning on screen:
- One idea per bullet; no sub-lists or semicolon chains.
- Each string field: at most 1–2 short sentences (roughly ≤140 characters when possible).
- Prefer the highest-impact gaps; omit minor formatting or stylistic notes.
- Do NOT enumerate every missing section — group related gaps (e.g. "Complete protocol narrative (design, recruitment, consent)").
- Do NOT use markdown bold or italic.`;

const reviewerAssessmentTool: ToolDefinition = {
  name: "reviewer_assessment",
  description: "Structured IRB reviewer assessment of a research proposal",
  parameters: {
    type: "object",
    properties: {
      decision: {
        type: "string",
        format: "enum",
        enum: [...REVIEW_DECISIONS],
      },
      confidence: {
        type: "string",
        format: "enum",
        enum: ["high", "medium", "low"],
      },
      key_findings: {
        type: "array",
        items: { type: "string" },
        description: "3–5 one-line findings (≤120 chars each)",
      },
      concerns: {
        type: "array",
        items: { type: "string" },
        description: "Up to 6 one-line concerns (≤120 chars each); empty if none",
      },
      conditions: {
        type: "array",
        items: { type: "string" },
        description: "Up to 4 one-line approval conditions (≤120 chars each); empty if none",
      },
      narrative: {
        type: "string",
        description: "2–4 sentences max summarizing your review",
      },
    },
    required: ["decision", "confidence", "key_findings", "concerns", "conditions", "narrative"],
  },
};

const boardSynthesisTool: ToolDefinition = {
  name: "board_synthesis",
  description: "Synthesized IRB board recommendation from multiple reviewer assessments",
  parameters: {
    type: "object",
    properties: {
      board_decision: {
        type: "string",
        format: "enum",
        enum: [...REVIEW_DECISIONS],
      },
      vote_summary: {
        type: "string",
        description: "One sentence on reviewer votes (≤120 chars)",
      },
      dissenting_views: {
        type: "array",
        items: { type: "string" },
        description: "Up to 3 one-line dissent points; empty if unanimous",
      },
      required_modifications: {
        type: "array",
        items: { type: "string" },
        description: "Up to 8 distinct one-line required changes (≤140 chars each); merge overlaps; empty if approved as-is",
      },
      recommended_conditions: {
        type: "array",
        items: { type: "string" },
        description: "Up to 4 one-line ongoing conditions (≤120 chars each)",
      },
      rationale: {
        type: "string",
        description: "2–4 sentences explaining the board decision",
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
${CONCISE_OUTPUT_RULES}${institutionGuidance}`;
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
${CONCISE_OUTPUT_RULES}${institutionGuidance}`;
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
${CONCISE_OUTPUT_RULES}${institutionGuidance}`;
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

Deduplicate overlapping reviewer points into the fewest clear required_modifications. Prioritize blockers over nice-to-haves.
${CONCISE_OUTPUT_RULES}${institutionGuidance}`;
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

  const result = await generateWithForcedToolCall<Omit<SimulatedReviewerAssessment, "role">>(
    "board-reviewer",
    {
      systemInstruction,
      history: [],
      userText,
      tool: reviewerAssessmentTool,
      maxOutputTokens: 2048,
    },
  );

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

  const userText = `Synthesize the following three independent reviewer assessments into a board recommendation. Keep required_modifications short and deduplicated.

${assessmentSummaries}`;

  const result = await generateWithForcedToolCall<SimulatedBoardSynthesis>("board-synthesis", {
    systemInstruction: boardChairSystem(institutionGuidance),
    history: [],
    userText,
    tool: boardSynthesisTool,
    maxOutputTokens: 2048,
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
    model_used: await resolveProviderForTask("board-reviewer"),
    completed_at: new Date().toISOString(),
  };
}
