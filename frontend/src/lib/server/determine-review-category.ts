import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { generateWithForcedToolCall } from "@/lib/server/gemini";
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

const CATEGORY_CRITERIA_REFERENCE = `
## IRB Review Category Decision Framework

IMPORTANT: Work through this framework systematically. Do NOT default to expedited_cat_7. Most behavioral/social research qualifies as EXEMPT under Categories 2 or 3 unless specific disqualifiers apply.

### Step 1: Check for Full Board Disqualifiers
If ANY of these apply, the study requires full_board review:
- Greater than minimal risk (risk exceeds what subjects encounter in daily life)
- Prisoners as subjects (Subpart C)
- FDA-regulated research requiring IND/IDE
- Classified research or research with national security implications
- Deception that could cause harm beyond embarrassment
- Procedures that could cause physical injury
- Research involving fetuses, pregnant women, or neonates AND greater than minimal risk (Subpart B)

### Step 2: Evaluate Exempt Eligibility (45 CFR 46.104(d))
Exempt review is appropriate when ALL general conditions are met:
- The ONLY involvement of human subjects falls within one or more exempt categories
- The research does NOT involve prisoners (unless Cat. 2(ii) secondary use of identifiable data with no re-consent)
- For Categories 2 and 3: subjects must be adults (18+) unless the research involves educational tests or observation of public behavior where the investigator does not participate

#### Exempt Category 1 — Normal educational practices [exempt_cat_1_educational_practices]
45 CFR 46.104(d)(1)
CRITERIA (ALL must apply):
- Conducted in established or commonly accepted educational settings (schools, universities, online learning platforms)
- Specifically involves normal educational practices such as: (a) research on regular and special education instructional strategies, (b) research on effectiveness of or comparison among instructional techniques, curricula, or classroom management methods
EXAMPLES: Comparing two teaching methods in a university course; evaluating a new curriculum; studying classroom management techniques
KEY DISTINCTIONS: The research must be about education itself, not merely conducted in a school. A psychology study in a classroom is NOT Cat. 1.

#### Exempt Category 2 — Surveys, interviews, educational tests, public observation [exempt_cat_2_surveys_interviews]
45 CFR 46.104(d)(2)
CRITERIA (ALL must apply):
- Research involves ONLY: educational tests (cognitive, diagnostic, aptitude, achievement), survey procedures, interview procedures, or observation of public behavior
- AND at least ONE of these information protections:
  (i) Information is recorded so subjects CANNOT be identified directly or through identifiers linked to subjects, OR
  (ii) Any disclosure of responses outside the research would NOT reasonably place subjects at risk of criminal or civil liability or be damaging to financial standing, employability, educational advancement, or reputation, OR
  (iii) Information is recorded with identifiers AND an IRB conducts limited review to ensure adequate privacy and confidentiality protections (per 46.111(a)(7))
EXAMPLES: Anonymous online surveys about workplace satisfaction; interviews about educational experiences with de-identified transcripts; standardized achievement testing; observing pedestrian behavior at crosswalks
KEY DISTINCTIONS FROM EXPEDITED CAT. 7: If the study uses ONLY surveys/interviews AND data is de-identified or low-risk if disclosed, it is Exempt Cat. 2, NOT Expedited Cat. 7. Expedited Cat. 7 applies when data remains identifiable AND the research goes beyond what Cat. 2 permits (e.g., involves children, or poses risk upon disclosure).
DISQUALIFIERS: Children as subjects (unless educational tests or public observation with no interaction); biospecimen collection; any physical intervention.

#### Exempt Category 3 — Benign behavioral interventions [exempt_cat_3_benign_behavioral]
45 CFR 46.104(d)(3)
CRITERIA (ALL must apply):
- Research involves benign behavioral interventions combined with collection of information from adult subjects who prospectively agree to the intervention and information collection
- "Benign behavioral intervention" means brief in duration, harmless, painless, not physically invasive, not likely to have significant adverse lasting impact, and the investigator has no reason to think subjects will find it offensive or embarrassing
- Same information protection conditions as Category 2 (i), (ii), or (iii)
EXAMPLES: Having subjects solve puzzles with varying background music; brief online tasks with randomized prompts; asking subjects to read or view materials then answer questions
KEY DISTINCTIONS FROM CAT. 2: Cat. 3 involves an experimental MANIPULATION or INTERVENTION (not just observation/survey). If the study only collects information via surveys/interviews, use Cat. 2. If there is an experimental condition assigned to participants, consider Cat. 3.
DISQUALIFIERS: Interventions involving deception (unless the subject authorizes the deception through prospective agreement); children; interventions longer than brief duration; interventions that could cause lasting impact.

#### Exempt Category 4 — Secondary research on existing data/biospecimens [exempt_cat_4_secondary_research]
45 CFR 46.104(d)(4)
CRITERIA (at least ONE must apply):
- (i) Publicly available data/biospecimens, OR
- (ii) Information recorded so subjects cannot be identified AND investigator does not contact subjects or re-identify, OR
- (iii) Federal statute requires data confidentiality (e.g., FERPA, HIPAA Safe Harbor), OR
- (iv) If federally supported: data/specimens are from a study conducted under an IRB-approved protocol with broad consent
EXAMPLES: Analysis of de-identified hospital discharge records; research using publicly available census data; meta-analysis of published datasets
KEY DISTINCTIONS: The data/specimens must ALREADY EXIST and have been collected for another purpose. If you are collecting NEW data, this is not Cat. 4.

#### Exempt Category 5 — Public benefit/service programs [exempt_cat_5_public_benefit_programs]
45 CFR 46.104(d)(5)
CRITERIA: Research/demonstration projects examining public benefit or service programs that must be:
- Conducted or supported by a federal department or agency
- Publicly listed before commencing (per OHRP posting requirement)
- Studying possible changes in or alternatives to those programs, or changes in methods/levels of payment for benefits
EXAMPLES: Evaluation of a new WIC program delivery model; studying the effects of policy changes in Medicaid
KEY DISTINCTIONS: Very narrow — requires federal conduct/support AND public posting. Rarely applicable to standard academic research.

#### Exempt Category 6 — Food taste and quality evaluation [exempt_cat_6_food_taste_evaluation]
45 CFR 46.104(d)(6)
CRITERIA: Taste and food quality evaluation and consumer acceptance studies if:
- Wholesome foods without additives are consumed, OR
- A food is consumed that contains a food ingredient at or below the level found safe by FDA, EPA, or FSIS
EXAMPLES: Blind taste tests comparing commercially available beverages
KEY DISTINCTIONS: Extremely narrow. Only food tasting, not nutrition interventions.

#### Exempt Category 7 — Storage/maintenance for future secondary research [exempt_cat_7_storage_for_secondary]
45 CFR 46.104(d)(7)
CRITERIA: Storage or maintenance of identifiable private information or identifiable biospecimens for potential secondary research use, with limited IRB review per 46.111(a)(7)
KEY DISTINCTIONS: This is about BANKING specimens/data, not about conducting research on them. Requires limited IRB review.

#### Exempt Category 8 — Secondary research under broad consent [exempt_cat_8_secondary_broad_consent]
45 CFR 46.104(d)(8)
CRITERIA: Research involving use of identifiable private information or identifiable biospecimens for secondary research if:
- Broad consent was obtained per 46.116(d)
- Limited IRB review per 46.111(a)(7)
- Investigator does not include returning individual results
KEY DISTINCTIONS: Only applies when valid broad consent (per 46.116(d)) exists.

### Step 3: If Not Exempt, Evaluate Expedited Categories (45 CFR 46.110)
Expedited review requires: minimal risk AND fits one of the 9 expedited categories.

#### Expedited Category 1 — Clinical studies of drugs/devices [expedited_cat_1_clinical_devices]
Studies of drugs or medical devices requiring no IND/IDE.

#### Expedited Category 2 — Blood collection [expedited_cat_2_blood_collection]
Finger stick, heel stick, ear stick, or venipuncture from healthy adults (≤550ml in 8-week period) or from other adults with volume/frequency consideration.

#### Expedited Category 3 — Non-invasive biological specimens [expedited_cat_3_noninvasive_specimens]
Prospective collection of biological specimens by non-invasive means: hair, nail clippings, deciduous teeth, saliva, dental plaque, sweat, uncannulated urine.

#### Expedited Category 4 — Routine non-invasive clinical procedures [expedited_cat_4_noninvasive_clinical_procedures]
Data collected through non-invasive procedures routinely employed in clinical practice (excluding general anesthesia or sedation, x-rays, microwaves). Includes: EKG, EEG, MRI (no contrast), ultrasound, moderate exercise, body composition assessment (DEXA, bioimpedance, skin fold calipers).

#### Expedited Category 5 — Existing non-research data/materials [expedited_cat_5_existing_data_materials]
Research involving materials collected solely for non-research purposes (e.g., medical records for diagnosis, pathology specimens).

#### Expedited Category 6 — Audio, video, image recordings [expedited_cat_6_recordings]
Collection of data from voice, video, digital, or image recordings made for research purposes. Does NOT apply when subjects can be identified and the recording could reasonably be used in a harmful way.

#### Expedited Category 7 — Individual/group characteristics or behavior [expedited_cat_7_behavioral_focus_groups]
Research on individual or group characteristics or behavior (including perceptions, cognition, motivation, identity, language, communication, cultural beliefs, social behavior) or research employing survey, interview, oral history, focus group, program evaluation, human factors evaluation, or quality assurance methodologies.
IMPORTANT: Only use this when the study does NOT qualify for exempt status. Common reasons a behavioral study needs expedited rather than exempt review:
- Involves children (under 18)
- Involves identifiable data where disclosure poses risk
- Involves sensitive topics where the interview/survey itself poses more than minimal emotional distress
- Involves audio/video recording of identifiable subjects in conjunction with behavioral data
- The study also includes a non-exempt component (e.g., a physiological measure)

#### Expedited Categories 8 & 9 — Continuing review (not applicable to new submissions)
Cat. 8: Continuing review where enrollment is complete and remaining activities limited to data analysis or follow-up.
Cat. 9: Continuing review of minimal-risk research not conducted under an IND/IDE.
NOTE: These categories are only for continuing review of previously approved research. They do NOT apply to new protocol submissions.

### Step 4: If Not Exempt or Expedited → Full Board Review
Full board review (21 CFR 56.108(c)) is required when the study involves greater than minimal risk. The IRB must satisfy seven approval criteria (21 CFR 56.111):
1. Risks minimized through sound research design
2. Risks reasonable relative to anticipated benefits
3. Equitable subject selection
4. Adequate informed consent
5. Adequate consent documentation
6. Adequate data safety monitoring where appropriate
7. Adequate privacy and confidentiality protections
Additional protections apply for vulnerable populations (prisoners under Subpart C, children under Subpart D, pregnant women/fetuses under Subpart B).

### Step 5: Decision Summary
After working through the framework:
1. First check full_board disqualifiers (Step 1)
2. Then evaluate exempt categories IN ORDER (Step 2) — most social/behavioral studies are Exempt Cat. 2 or Cat. 3
3. Only if no exempt category fits, evaluate expedited categories (Step 3)
4. If neither exempt nor expedited fits, assign full_board (Step 4)
5. If information is insufficient, default to full_board (the IRB can always downgrade)
`;

const categoryDeclaration: FunctionDeclaration = {
  name: "category_determination",
  description: "Determine IRB review category through structured regulatory analysis",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      full_board_disqualifiers: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: "List any factors that would require full board review. Empty array if none found.",
      },
      exempt_evaluation: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            category: { type: SchemaType.STRING, description: "e.g. exempt_cat_2_surveys_interviews" },
            fits: { type: SchemaType.BOOLEAN },
            reason: { type: SchemaType.STRING, description: "Why this category does or does not apply" },
          },
          required: ["category", "fits", "reason"],
        },
        description: "Evaluate each potentially applicable exempt category. Include at least Cat. 2, 3, and 4.",
      },
      expedited_evaluation: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            category: { type: SchemaType.STRING },
            fits: { type: SchemaType.BOOLEAN },
            reason: { type: SchemaType.STRING },
          },
          required: ["category", "fits", "reason"],
        },
        description: "Only evaluate expedited categories if no exempt category fits.",
      },
      predicted_category: {
        type: SchemaType.STRING,
        format: "enum",
        enum: REVIEW_TYPE_VALUES.filter((v) => v !== "not_sure"),
        description: "The most specific applicable review type value.",
      },
      confidence: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["high", "medium", "low"],
        description: "Confidence in the determination: high = clear match, medium = probable but missing some info, low = uncertain.",
      },
      reasoning: {
        type: SchemaType.STRING,
        description: "2-3 sentence explanation of why this category was chosen over alternatives.",
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

  const hasSupplementary = supplementaryContext.trim().length > 50;

  const userText = `Using the Category Decision Framework below, determine the correct IRB review category for this study.

IMPORTANT: Work through the framework step by step. Do NOT skip to expedited_cat_7 — most social/behavioral research qualifies as EXEMPT under Cat. 2 or Cat. 3. Only assign expedited_cat_7 if you can articulate why no exempt category applies.

${CATEGORY_CRITERIA_REFERENCE}

---

## Study Materials

${hasSupplementary ? "IMPORTANT: The researcher uploaded documents (shown under Supplementary materials below). These documents are PRIMARY SOURCE MATERIAL and carry equal or greater weight than the protocol sections. Base your category determination on ALL available information — protocol sections, consent document, AND uploaded documents together. Do NOT default to not_sure simply because protocol sections are incomplete if the uploaded documents contain the relevant details." : ""}

### Protocol
${protocolText || "(protocol sections are sparse — rely on supplementary materials below for study details)"}

### Consent
${consentMarkdown || "(no consent document provided)"}

${supplementaryContext}

---

Now work through the decision framework step by step. Evaluate full board disqualifiers first, then exempt categories (especially Cat. 2 and Cat. 3), and only then expedited categories if no exempt category fits.${hasSupplementary ? " Use details from the uploaded documents to fill in any gaps in the protocol sections." : ""}`;

  const result = await generateWithForcedToolCall<{
    full_board_disqualifiers: string[];
    exempt_evaluation: CategoryConsideration[];
    expedited_evaluation: CategoryConsideration[];
    predicted_category: string;
    confidence: string;
    reasoning: string;
  }>({
    systemInstruction:
      "You are an IRB review category analyst. You determine the correct regulatory review pathway using 45 CFR 46. You MUST work through the decision framework systematically and justify your determination. Do NOT default to expedited_cat_7 — evaluate exempt categories first. Do NOT use markdown bold (**text**) or italic formatting in your output.",
    history: [],
    userText,
    declaration: categoryDeclaration,
    toolName: "category_determination",
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
