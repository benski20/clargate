import type { ReviewDecision } from "@/lib/types";

export type SimulatedReviewerRole = "primary" | "ethics" | "regulatory";

export type SimulatedReviewerAssessment = {
  readonly role: SimulatedReviewerRole;
  readonly decision: ReviewDecision;
  readonly confidence: "high" | "medium" | "low";
  readonly key_findings: readonly string[];
  readonly concerns: readonly string[];
  readonly conditions: readonly string[];
  readonly narrative: string;
};

export type SimulatedBoardSynthesis = {
  readonly board_decision: ReviewDecision;
  readonly vote_summary: string;
  readonly dissenting_views: readonly string[];
  readonly required_modifications: readonly string[];
  readonly recommended_conditions: readonly string[];
  readonly rationale: string;
};

export type SimulatedBoardReviewResult = {
  readonly reviewer_assessments: readonly SimulatedReviewerAssessment[];
  readonly synthesis: SimulatedBoardSynthesis;
  readonly model_used: string;
  readonly completed_at: string;
};
