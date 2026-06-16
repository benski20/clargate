/** Regulatory review pathway (coarse). */
export type ReviewPathway = "exempt" | "expedited" | "full_board" | "not_sure";

/**
 * Stored on proposals and in AI workspace state.
 * Granular values map to 45 CFR 46.104 exempt and 46.110 expedited categories.
 */
export type ReviewType =
  | "exempt"
  | "expedited"
  | "full_board"
  | "not_sure"
  | "exempt_cat_1_educational_practices"
  | "exempt_cat_2_surveys_interviews"
  | "exempt_cat_3_benign_behavioral"
  | "exempt_cat_4_secondary_research"
  | "exempt_cat_5_public_benefit_programs"
  | "exempt_cat_6_food_taste_evaluation"
  | "exempt_cat_7_storage_for_secondary"
  | "exempt_cat_8_secondary_broad_consent"
  | "expedited_cat_1_clinical_devices"
  | "expedited_cat_2_blood_collection"
  | "expedited_cat_3_noninvasive_specimens"
  | "expedited_cat_4_noninvasive_clinical_procedures"
  | "expedited_cat_5_existing_data_materials"
  | "expedited_cat_6_recordings"
  | "expedited_cat_7_behavioral_focus_groups";

export type ReviewTypeOption = {
  value: ReviewType;
  label: string;
  description: string;
  pathway: ReviewPathway;
  cfrRef: string;
};

export const REVIEW_TYPE_OPTIONS: ReviewTypeOption[] = [
  {
    value: "exempt_cat_1_educational_practices",
    label: "Exempt · Cat. 1 — Normal educational practices",
    description:
      "Research in established educational settings involving standard instructional strategies, curricula, or classroom management techniques.",
    pathway: "exempt",
    cfrRef: "45 CFR 46.104(d)(1)",
  },
  {
    value: "exempt_cat_2_surveys_interviews",
    label: "Exempt · Cat. 2 — Surveys, interviews & public observation",
    description:
      "Surveys, interviews, educational tests, or observation of public behavior with adult subjects, where data are recorded anonymously, disclosure would not put subjects at risk, or adequate privacy protections are in place (limited IRB review).",
    pathway: "exempt",
    cfrRef: "45 CFR 46.104(d)(2)",
  },
  {
    value: "exempt_cat_3_benign_behavioral",
    label: "Exempt · Cat. 3 — Benign behavioral interventions",
    description:
      "Brief, harmless, painless behavioral interventions (not just observation) with adult subjects who prospectively agree, where data protections match Cat. 2 requirements. Distinct from Cat. 2 because there is an experimental manipulation, not just data collection.",
    pathway: "exempt",
    cfrRef: "45 CFR 46.104(d)(3)",
  },
  {
    value: "exempt_cat_4_secondary_research",
    label: "Exempt · Cat. 4 — Secondary use of existing data",
    description:
      "Secondary research using identifiable private information or biospecimens originally collected for another purpose, when publicly available or appropriately protected.",
    pathway: "exempt",
    cfrRef: "45 CFR 46.104(d)(4)",
  },
  {
    value: "exempt_cat_5_public_benefit_programs",
    label: "Exempt · Cat. 5 — Public benefit or service programs",
    description:
      "Research or demonstration projects designed to study, evaluate, or examine public benefit or service programs.",
    pathway: "exempt",
    cfrRef: "45 CFR 46.104(d)(5)",
  },
  {
    value: "exempt_cat_6_food_taste_evaluation",
    label: "Exempt · Cat. 6 — Food taste & quality evaluation",
    description:
      "Taste and food quality evaluation or consumer acceptance studies using foods approved for human consumption.",
    pathway: "exempt",
    cfrRef: "45 CFR 46.104(d)(6)",
  },
  {
    value: "exempt_cat_7_storage_for_secondary",
    label: "Exempt · Cat. 7 — Storage for future secondary research",
    description:
      "Storage or maintenance of identifiable private information or biospecimens for secondary research (limited IRB review required).",
    pathway: "exempt",
    cfrRef: "45 CFR 46.104(d)(7)",
  },
  {
    value: "exempt_cat_8_secondary_broad_consent",
    label: "Exempt · Cat. 8 — Secondary research with broad consent",
    description:
      "Secondary research using identifiable private information or biospecimens when broad consent was obtained (limited IRB review required).",
    pathway: "exempt",
    cfrRef: "45 CFR 46.104(d)(8)",
  },
  {
    value: "exempt",
    label: "Exempt — category not yet specified",
    description: "Likely exempt under 45 CFR 46.104, but a specific exemption category has not been identified.",
    pathway: "exempt",
    cfrRef: "45 CFR 46.104",
  },
  {
    value: "expedited_cat_1_clinical_devices",
    label: "Expedited · Cat. 1 — Clinical drugs & devices",
    description:
      "Clinical studies of drugs or medical devices when an IND/IDE is not required, or the device is cleared/approved and used per labeling.",
    pathway: "expedited",
    cfrRef: "45 CFR 46.110",
  },
  {
    value: "expedited_cat_2_blood_collection",
    label: "Expedited · Cat. 2 — Blood collection",
    description:
      "Routine blood draws by finger stick, heel stick, ear stick, or venipuncture within federal volume and frequency limits.",
    pathway: "expedited",
    cfrRef: "45 CFR 46.110",
  },
  {
    value: "expedited_cat_3_noninvasive_specimens",
    label: "Expedited · Cat. 3 — Non-invasive biological specimens",
    description:
      "Prospective collection of biological specimens by non-invasive means (e.g., hair, saliva, nail clippings, excretia).",
    pathway: "expedited",
    cfrRef: "45 CFR 46.110",
  },
  {
    value: "expedited_cat_4_noninvasive_clinical_procedures",
    label: "Expedited · Cat. 4 — Routine non-invasive clinical procedures",
    description:
      "Collection of data through non-invasive procedures routinely employed in clinical practice, excluding x-rays and general anesthesia.",
    pathway: "expedited",
    cfrRef: "45 CFR 46.110",
  },
  {
    value: "expedited_cat_5_existing_data_materials",
    label: "Expedited · Cat. 5 — Existing non-research data or materials",
    description:
      "Research involving materials or data collected solely for non-research purposes (e.g., medical records, pathology specimens).",
    pathway: "expedited",
    cfrRef: "45 CFR 46.110",
  },
  {
    value: "expedited_cat_6_recordings",
    label: "Expedited · Cat. 6 — Audio, video & image recordings",
    description:
      "Research collecting data from voice, video, digital, or image recordings made for research purposes.",
    pathway: "expedited",
    cfrRef: "45 CFR 46.110",
  },
  {
    value: "expedited_cat_7_behavioral_focus_groups",
    label: "Expedited · Cat. 7 — Behavioral research & focus groups",
    description:
      "Research on individual/group characteristics or behavior using surveys, interviews, focus groups, or program evaluation — only when exempt status does not apply (e.g., involves children, identifiable data with disclosure risk, or sensitive topics posing more than minimal emotional distress).",
    pathway: "expedited",
    cfrRef: "45 CFR 46.110",
  },
  {
    value: "expedited",
    label: "Expedited — category not yet specified",
    description: "Likely minimal-risk expedited review under 45 CFR 46.110, but a specific category has not been identified.",
    pathway: "expedited",
    cfrRef: "45 CFR 46.110",
  },
  {
    value: "full_board",
    label: "Full board review",
    description:
      "Greater than minimal risk, vulnerable populations, deception, or other factors requiring convened IRB review.",
    pathway: "full_board",
    cfrRef: "45 CFR 46.108",
  },
  {
    value: "not_sure",
    label: "Not sure — IRB will determine",
    description: "Review pathway has not been determined; the IRB will assign the appropriate category.",
    pathway: "not_sure",
    cfrRef: "",
  },
];

export const REVIEW_TYPE_VALUES: ReviewType[] = REVIEW_TYPE_OPTIONS.map((o) => o.value);

const REVIEW_TYPE_BY_VALUE = new Map<ReviewType, ReviewTypeOption>(
  REVIEW_TYPE_OPTIONS.map((o) => [o.value, o]),
);

export const REVIEW_TYPE_GROUPS: {
  pathway: ReviewPathway;
  title: string;
  options: ReviewTypeOption[];
}[] = [
  {
    pathway: "exempt",
    title: "Exempt (45 CFR 46.104)",
    options: REVIEW_TYPE_OPTIONS.filter((o) => o.pathway === "exempt"),
  },
  {
    pathway: "expedited",
    title: "Expedited (45 CFR 46.110)",
    options: REVIEW_TYPE_OPTIONS.filter((o) => o.pathway === "expedited"),
  },
  {
    pathway: "full_board",
    title: "Full board",
    options: REVIEW_TYPE_OPTIONS.filter((o) => o.pathway === "full_board"),
  },
  {
    pathway: "not_sure",
    title: "Undetermined",
    options: REVIEW_TYPE_OPTIONS.filter((o) => o.pathway === "not_sure"),
  },
];

export function isValidReviewType(value: string | null | undefined): value is ReviewType {
  return typeof value === "string" && REVIEW_TYPE_VALUES.includes(value as ReviewType);
}

export function getReviewPathway(type: ReviewType | string | null | undefined): ReviewPathway | null {
  if (!type) return null;
  const opt = REVIEW_TYPE_BY_VALUE.get(type as ReviewType);
  if (opt) return opt.pathway;
  if (type.startsWith("exempt")) return "exempt";
  if (type.startsWith("expedited")) return "expedited";
  if (type === "full_board") return "full_board";
  if (type === "not_sure") return "not_sure";
  return null;
}

export function formatReviewTypeLabel(type: ReviewType | string | null | undefined): string {
  if (!type) return "—";
  return REVIEW_TYPE_BY_VALUE.get(type as ReviewType)?.label ?? type.replace(/_/g, " ");
}

export function getReviewTypeOption(type: ReviewType | string | null | undefined): ReviewTypeOption | null {
  if (!type) return null;
  return REVIEW_TYPE_BY_VALUE.get(type as ReviewType) ?? null;
}

/** Normalize AI or legacy coarse values into a valid stored review type. */
export function normalizeReviewType(value: string | null | undefined): ReviewType {
  if (isValidReviewType(value)) return value;
  return "full_board";
}
