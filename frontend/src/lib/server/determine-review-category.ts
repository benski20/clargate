import { generateWithForcedToolCall, type ToolDefinition } from "@/lib/server/ai";
import type { ProtocolDraft } from "@/lib/ai-proposal-types";
import { PROTOCOL_SECTION_KEYS } from "@/lib/ai-proposal-types";
import type { ReviewType } from "@/lib/review-types";
import { isValidReviewType, REVIEW_TYPE_VALUES } from "@/lib/review-types";

export type CategoryDetermination = {
  predicted_category: ReviewType;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  disqualifying_factors: string[];
  considered_categories: CategoryConsideration[];
};

type CategoryConsideration = {
  category: string;
  fits: boolean;
  reason: string;
};

const DECISION_PROCESS = `
## IRB Review Category Decision Process

You MUST search your knowledge base for the applicable federal regulations BEFORE making any determination. Do not rely on memory — look up the actual regulatory text for every step.

### Step 1: Search for full board disqualifiers
Search the knowledge base for criteria that require full board review under 45 CFR 46 and 21 CFR 56. Check every procedure, population, and data type in the study against these criteria. Pay special attention to:
- Whether any procedure poses greater than minimal risk (search for the regulatory definition of minimal risk)
- Whether any procedure involves radiation, invasive devices, or physical risk (search for specific guidance on each procedure type mentioned in the protocol)
- Whether vulnerable populations are involved (search Subparts B, C, D)
- Whether FDA-regulated products are involved (search 21 CFR 56)

### Step 2: If no full board disqualifiers, evaluate exempt categories
Search the knowledge base for 45 CFR 46.104(d) — the exempt categories. Evaluate each potentially applicable category against the study design. For each category you consider, search for its specific criteria and disqualifiers. Do NOT assume a procedure qualifies — verify against the regulation.

### Step 3: If no exempt category fits, evaluate expedited categories
Search the knowledge base for 45 CFR 46.110 and the expedited review categories. For EACH procedure in the study, search for whether it appears in or is excluded from the expedited categories. Procedures involving radiation exposure, x-rays, or ionizing radiation require special scrutiny — search for specific regulatory guidance.

### Step 4: If neither exempt nor expedited fits, assign full board

### Step 5: Decision
1. Full board disqualifiers override everything
2. Evaluate exempt categories before expedited
3. Only assign expedited if you can explain why every exempt category was ruled out
4. If information is insufficient, default to full_board
`;

const categoryTool: ToolDefinition = {
  name: "category_determination",
  description: "Determine IRB review category through structured regulatory analysis",
  parameters: {
    type: "object",
    properties: {
      full_board_disqualifiers: {
        type: "array",
        items: { type: "string" },
        description: "List any factors that would require full board review. Empty array if none found.",
      },
      exempt_evaluation: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string", description: "e.g. exempt_cat_2_surveys_interviews" },
            fits: { type: "boolean" },
            reason: { type: "string", description: "One sentence (≤120 chars)" },
          },
          required: ["category", "fits", "reason"],
        },
        description: "Evaluate each potentially applicable exempt category. Include at least Cat. 2, 3, and 4.",
      },
      expedited_evaluation: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            fits: { type: "boolean" },
            reason: { type: "string" },
          },
          required: ["category", "fits", "reason"],
        },
        description: "Only evaluate expedited categories if no exempt category fits.",
      },
      predicted_category: {
        type: "string",
        description:
          "The most specific review type value matching the bracket labels in the framework, e.g. exempt_cat_2_surveys_interviews. Use an exempt category if ANY exempt category fits — only fall back to expedited if you can explain why every exempt category was ruled out.",
      },
      confidence: {
        type: "string",
        format: "enum",
        enum: ["high", "medium", "low"],
        description: "Confidence in the determination: high = clear match, medium = probable but missing some info, low = uncertain.",
      },
      reasoning: {
        type: "string",
        description: "1–2 sentences explaining why this category was chosen",
      },
    },
    required: [
      "full_board_disqualifiers",
      "exempt_evaluation",
      "expedited_evaluation",
      "predicted_category",
      "confidence",
      "reasoning",
    ],
  },
};

export async function determineReviewCategory(
  protocol: ProtocolDraft,
  consentMarkdown: string,
  supplementaryContext: string,
): Promise<CategoryDetermination> {
  const protocolText = PROTOCOL_SECTION_KEYS.map(
    (key) => `### ${key.replace(/_/g, " ")}\n${(protocol[key] ?? "").trim()}`,
  )
    .filter((section) => section.length > 20)
    .join("\n\n");

  const userText = `Determine the correct IRB review category for this study.

MANDATORY: Before answering, you MUST search your knowledge base for the federal regulations applicable to EACH procedure and population in this study. Do not rely on your training data for regulatory details — the knowledge base is your source of truth.

${DECISION_PROCESS}

---

## Study Materials

### Protocol
${protocolText}

### Consent
${consentMarkdown || "(no consent document provided)"}

${supplementaryContext}

---

For EACH procedure mentioned (surveys, scans, blood draws, interventions, etc.), search the knowledge base for the specific regulatory treatment of that procedure. Then work through the decision process step by step.

Use these exact category identifiers in your response:
exempt_cat_1_educational_practices, exempt_cat_2_surveys_interviews, exempt_cat_3_benign_behavioral, exempt_cat_4_secondary_research, exempt_cat_5_public_benefit_programs, exempt_cat_6_food_taste_evaluation, exempt_cat_7_storage_for_secondary, exempt_cat_8_secondary_broad_consent, expedited_cat_1_clinical_devices, expedited_cat_2_blood_collection, expedited_cat_3_noninvasive_specimens, expedited_cat_4_noninvasive_clinical_procedures, expedited_cat_5_existing_data_materials, expedited_cat_6_recordings, expedited_cat_7_behavioral_focus_groups, full_board`;

  const result = await generateWithForcedToolCall<{
    full_board_disqualifiers: string[];
    exempt_evaluation: CategoryConsideration[];
    expedited_evaluation: CategoryConsideration[];
    predicted_category: string;
    confidence: string;
    reasoning: string;
  }>("category-prediction", {
    systemInstruction:
      "You are an IRB regulatory analyst. You MUST search your knowledge base for the applicable federal regulations before making any determination. Never rely solely on training data for regulatory facts — always verify against the knowledge base. For every procedure in the study (scans, blood draws, surveys, interventions, devices, radiation exposure, etc.), search for its specific regulatory treatment. Your knowledge base contains 45 CFR 46, 21 CFR 56, OHRP decision charts, and related guidance. Do NOT use markdown bold (**text**) or italic formatting in your output.",
    history: [],
    userText,
    tool: categoryTool,
    maxOutputTokens: 4096,
  });

  const category = isValidReviewType(result.predicted_category)
    ? result.predicted_category
    : "full_board";

  const confidence =
    result.confidence === "high" || result.confidence === "medium" || result.confidence === "low"
      ? result.confidence
      : "low";

  return {
    predicted_category: category,
    confidence,
    reasoning: result.reasoning,
    disqualifying_factors: result.full_board_disqualifiers,
    considered_categories: [
      ...result.exempt_evaluation,
      ...result.expedited_evaluation,
    ],
  };
}
