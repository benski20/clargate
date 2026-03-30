import type { AiWorkspaceState } from "@/lib/ai-proposal-types";

/** Maps AI workspace into existing proposal form_data keys for downstream views. */
export function buildFormDataFromAiWorkspace(ai: AiWorkspaceState, studyTitle: string): Record<string, unknown> {
  const p = ai.protocol;
  const title = studyTitle.trim() || "Draft study";
  return {
    entry_mode: "ai_draft",
    ai_workspace: ai,
    study_info: {
      title,
      review_type: ai.predicted_category ?? "not_sure",
      description: p.background_rationale,
      objectives: p.study_design,
    },
    research_team: { pi_name: "", co_investigators: "", department: "" },
    participants: {
      population: p.participants,
      age_range: "",
      sample_size: "",
      vulnerable: "",
    },
    recruitment: { methods: p.recruitment, materials: "", compensation: "" },
    data_collection: {
      methods: p.procedures,
      data_types: "",
      storage: p.confidentiality,
      duration: "",
    },
    risk_assessment: {
      risks: p.risks_benefits,
      benefits: "",
      mitigation: "",
      consent_process: p.consent_process,
    },
    consent_draft_markdown: ai.consent_markdown,
  };
}
