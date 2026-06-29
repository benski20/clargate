import type { ComplianceFlag, ProtocolDraft } from "@/lib/ai-proposal-types";
import type { ReviewType } from "@/lib/review-types";

export type ComplianceSignals = Record<string, boolean>;

const MINOR_PATTERNS =
  /\b(child(?:ren)?|minor(?:s)?|under\s*18|pediatric|adolescent|youth|ages?\s+\d{1,2}\s*[-–to]+\s*1[0-7])\b/i;

const PRISONER_PATTERNS = /\b(prisoner|incarcerat|inmate|correctional|detainee)\b/i;

const VULNERABLE_POP_PATTERNS =
  /\b(child(?:ren)?|minor|prisoner|incarcerat|mentally\s+(?:impair|disabl)|cognitiv(?:e|ely)\s+impair|pregnant\s+wom[ae]n)\b/i;

const INTERNATIONAL_PATTERNS =
  /\b(international|outside\s+(?:the\s+)?(?:US|United\s+States)|abroad|foreign\s+country|overseas)\b/i;

const FOOD_SUPPLEMENT_PATTERNS =
  /\b(food\s+product|nutritional\s+supplement|dietary\s+supplement|dosage|administer)\b/i;

const BIOLOGICAL_PATTERNS =
  /\b(blood|urine|tissue|saliva|biological\s+sample|specimen|biopsy|serum|plasma)\b/i;

const RECORDING_PATTERNS =
  /\b(audio[- ]?record|video[- ]?record|film|tape|transcri(?:be|pt)|zoom\s+record)\b/i;

const ONLINE_PLATFORM_PATTERNS =
  /\b(qualtrics|mturk|mechanical\s+turk|survey\s+monkey|surveymonkey|prolific|redcap|google\s+forms?)\b/i;

const MEDICAL_RECORD_PATTERNS =
  /\b(medical\s+record|health\s+record|patient\s+chart|EHR|EMR|clinical\s+record|HIPAA)\b/i;

const PII_PATTERNS =
  /\b(personally\s+identifiable|PII|social\s+security|SSN|identifiable\s+data|name[ds]?\s+(?:and|&)\s+address|email\s+address)\b/i;

const COMPENSATION_PATTERNS =
  /\b(compensat|payment|paid|gift\s+card|incentive|remunerat|stipend|\$\d+)\b/i;

const RELATIONSHIP_PATTERNS =
  /\b(teacher.{0,10}student|instructor.{0,10}student|employer.{0,10}employee|supervisor|subordinat|authority\s+(?:over|relationship))\b/i;

const NON_ENGLISH_PATTERNS =
  /\b(non[- ]?English|translat(?:e|ion|ed)|Spanish|Chinese|Arabic|French|bilingual|multilingual)\b/i;

const COLLABORATION_PATTERNS =
  /\b(collaborat(?:e|ing|ion)|partner(?:ship|ing)|multi[- ]?site|joint\s+(?:study|research)|co[- ]?investigat)\b/i;

const INTERVIEW_PATTERNS =
  /\b(interview|semi[- ]?structured|unstructured\s+interview|structured\s+interview)\b/i;

const PAPER_SURVEY_PATTERNS =
  /\b(paper\s+survey|paper\s+questionnaire|printed\s+survey|pencil[- ]?and[- ]?paper)\b/i;

const INTERNET_SURVEY_PATTERNS =
  /\b(online\s+survey|internet\s+survey|web[- ]?based\s+survey|electronic\s+survey|e[- ]?survey)\b/i;

const FOCUS_GROUP_PATTERNS = /\b(focus\s+group)\b/i;

const EXISTING_RECORDS_PATTERNS =
  /\b(existing\s+(?:record|data|dataset)|archival\s+(?:data|record)|secondary\s+(?:data|analysis)|retrospective\s+(?:chart|review))\b/i;

const OBSERVATION_PATTERNS =
  /\b(observ(?:e|ation|ational|ing)\s+(?:participants?|subjects?|behavior|study)|participant\s+observation|field\s+observation|naturalistic\s+observation)\b/i;

const CONSENT_INCAPABLE_PATTERNS =
  /\b(cannot\s+consent|unable\s+to\s+consent|parental\s+consent|guardian\s+consent|assent|legally\s+authorized\s+representative|LAR)\b/i;

function textContains(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function flagMentions(
  flags: readonly ComplianceFlag[],
  pattern: RegExp,
): boolean {
  return flags.some(
    (flag) =>
      pattern.test(flag.message) ||
      (flag.actionable !== undefined && pattern.test(flag.actionable)),
  );
}

export function extractComplianceSignals(
  protocol: ProtocolDraft,
  complianceFlags: readonly ComplianceFlag[],
  predictedCategory: ReviewType | null,
  contextNotes: string,
): ComplianceSignals {
  const allText = [
    protocol.background_rationale,
    protocol.study_design,
    protocol.participants,
    protocol.recruitment,
    protocol.procedures,
    protocol.risks_benefits,
    protocol.confidentiality,
    protocol.consent_process,
    contextNotes,
  ].join(" ");

  const participantText = [
    protocol.participants,
    protocol.recruitment,
  ].join(" ");

  const proceduresText = [
    protocol.procedures,
    protocol.study_design,
  ].join(" ");

  return {
    has_funding:
      textContains(allText, /\b(fund(?:ed|ing)|grant|sponsor|NIH|NSF|award)\b/i) ||
      flagMentions(complianceFlags, /fund/i),

    has_collaboration:
      textContains(allText, COLLABORATION_PATTERNS) ||
      flagMentions(complianceFlags, /collaborat/i),

    involves_international:
      textContains(allText, INTERNATIONAL_PATTERNS) ||
      flagMentions(complianceFlags, INTERNATIONAL_PATTERNS),

    uses_non_english:
      textContains(allText, NON_ENGLISH_PATTERNS) ||
      flagMentions(complianceFlags, NON_ENGLISH_PATTERNS),

    is_exempt: predictedCategory === "exempt",
    is_expedited_or_full:
      predictedCategory === "expedited" || predictedCategory === "full_board",

    involves_minors:
      textContains(participantText, MINOR_PATTERNS) ||
      flagMentions(complianceFlags, MINOR_PATTERNS),

    involves_prisoners:
      textContains(participantText, PRISONER_PATTERNS) ||
      flagMentions(complianceFlags, PRISONER_PATTERNS),

    involves_vulnerable_populations:
      textContains(participantText, VULNERABLE_POP_PATTERNS) ||
      flagMentions(complianceFlags, VULNERABLE_POP_PATTERNS),

    involves_food_supplement:
      textContains(proceduresText, FOOD_SUPPLEMENT_PATTERNS),

    collects_biological_samples:
      textContains(proceduresText, BIOLOGICAL_PATTERNS) ||
      flagMentions(complianceFlags, BIOLOGICAL_PATTERNS),

    uses_recordings:
      textContains(proceduresText, RECORDING_PATTERNS) ||
      flagMentions(complianceFlags, RECORDING_PATTERNS),

    uses_online_platforms:
      textContains(proceduresText, ONLINE_PLATFORM_PATTERNS) ||
      textContains(allText, ONLINE_PLATFORM_PATTERNS),

    accesses_medical_records:
      textContains(allText, MEDICAL_RECORD_PATTERNS) ||
      flagMentions(complianceFlags, MEDICAL_RECORD_PATTERNS),

    collects_pii:
      textContains(protocol.confidentiality, PII_PATTERNS) ||
      textContains(allText, PII_PATTERNS) ||
      flagMentions(complianceFlags, PII_PATTERNS),

    uses_compensation:
      textContains(protocol.risks_benefits, COMPENSATION_PATTERNS) ||
      textContains(allText, COMPENSATION_PATTERNS),

    has_pre_existing_relationships:
      textContains(allText, RELATIONSHIP_PATTERNS) ||
      flagMentions(complianceFlags, RELATIONSHIP_PATTERNS),

    has_financial_interest: false,

    subjects_cannot_self_consent:
      textContains(participantText, CONSENT_INCAPABLE_PATTERNS) ||
      textContains(protocol.consent_process, CONSENT_INCAPABLE_PATTERNS) ||
      textContains(participantText, MINOR_PATTERNS),

    uses_interviews: textContains(proceduresText, INTERVIEW_PATTERNS),
    uses_paper_surveys: textContains(proceduresText, PAPER_SURVEY_PATTERNS),
    uses_internet_surveys:
      textContains(proceduresText, INTERNET_SURVEY_PATTERNS) ||
      textContains(allText, ONLINE_PLATFORM_PATTERNS),
    uses_focus_groups: textContains(proceduresText, FOCUS_GROUP_PATTERNS),
    uses_existing_records: textContains(proceduresText, EXISTING_RECORDS_PATTERNS),
    uses_observation: textContains(proceduresText, OBSERVATION_PATTERNS),
  };
}
