import type { CayuseSection } from "@/lib/compliance-questionnaire-types";

type Attachment = { name: string; text: string };

const SECTION_KEYWORDS: Record<CayuseSection, readonly string[]> = {
  core_information: [
    "funding", "grant", "sponsor", "nsf", "nih", "contract", "award",
    "discipline", "department", "pi ", "principal investigator",
    "multi-site", "multisite", "collaboration", "international",
    "language", "non-english", "translation",
  ],
  personnel: [
    "co-investigator", "co-pi", "research assistant", "coordinator",
    "faculty", "student researcher", "citi", "training", "certification",
    "responsible conduct", "mentor", "supervisor",
  ],
  research_focus: [
    "hypothesis", "research question", "objective", "aim",
    "purpose of the study", "background", "rationale", "literature",
  ],
  methods: [
    "methodology", "study design", "procedure", "intervention",
    "randomiz", "control group", "placebo", "blinding", "double-blind",
    "qualitative", "quantitative", "mixed method", "longitudinal",
    "cross-sectional", "ethnograph", "phenomenolog",
    "food", "supplement", "drug", "device", "fda",
  ],
  subjects_recruitment: [
    "participant", "subject", "sample size", "enrollment",
    "eligibility", "inclusion criteria", "exclusion criteria",
    "recruit", "flyer", "advertisement", "snowball",
    "minor", "child", "adolescent", "pediatric",
    "prisoner", "incarcerated", "detain",
    "pregnant", "vulnerable", "cognitiv", "impair",
    "age range", "years old", "population",
  ],
  data_collection: [
    "survey", "questionnaire", "interview", "focus group",
    "observation", "recording", "audio", "video", "photograph",
    "biological", "specimen", "blood", "saliva", "tissue", "biospecimen",
    "qualtrics", "redcap", "mturk", "prolific", "online platform",
    "medical record", "health record", "ehr", "chart review",
    "existing data", "secondary data", "de-identif",
  ],
  data_security: [
    "confidential", "privacy", "anonymo", "de-identif", "pseudonym",
    "encrypt", "password", "secure", "storage", "server", "cloud",
    "hipaa", "ferpa", "identif", "pii", "personally identifiable",
    "ssn", "social security", "date of birth", "ip address",
    "retention", "destroy", "delete", "shred",
    "access control", "locked", "firewall",
  ],
  risks_benefits: [
    "risk", "harm", "discomfort", "distress", "adverse",
    "benefit", "compensation", "incentive", "gift card", "payment",
    "course credit", "raffle", "reimburs",
    "minimal risk", "greater than minimal",
    "deception", "debriefing", "withhold",
    "referral", "resource", "counseling",
  ],
  affiliations_coi: [
    "conflict of interest", "financial interest", "disclosure",
    "affiliation", "external site", "collaborat",
    "industry", "consulting", "equity", "royalt",
  ],
  consent_assent: [
    "consent", "assent", "informed consent", "waiver of consent",
    "parental permission", "guardian", "legal representative",
    "capacity", "competence", "witness",
    "opt-out", "opt-in", "passive consent",
    "information sheet", "consent form",
    "ongoing consent", "re-consent", "withdrawal",
  ],
};

const PARAGRAPH_CHAR_LIMIT = 600;
const SECTION_EVIDENCE_LIMIT = 2000;
const TOTAL_EVIDENCE_LIMIT = 20_000;

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 20);
}

function paragraphMatchesSection(
  paragraphLower: string,
  section: CayuseSection,
): boolean {
  const keywords = SECTION_KEYWORDS[section];
  return keywords.some((keyword) => paragraphLower.includes(keyword));
}

export function extractDocumentEvidence(
  attachments: readonly Attachment[],
  activeSections: readonly CayuseSection[],
): string {
  if (attachments.length === 0 || activeSections.length === 0) return "";

  const allParagraphs: Array<{ text: string; lower: string; source: string }> = [];
  for (const attachment of attachments) {
    if (!attachment.text?.trim()) continue;
    const paragraphs = splitIntoParagraphs(attachment.text);
    for (const paragraph of paragraphs) {
      allParagraphs.push({
        text: paragraph.length > PARAGRAPH_CHAR_LIMIT
          ? paragraph.slice(0, PARAGRAPH_CHAR_LIMIT) + "…"
          : paragraph,
        lower: paragraph.toLowerCase(),
        source: attachment.name,
      });
    }
  }

  if (allParagraphs.length === 0) return "";

  const sectionEvidence: Array<{ section: CayuseSection; entries: string[] }> = [];
  let totalLength = 0;

  for (const section of activeSections) {
    const matches: string[] = [];
    let sectionLength = 0;

    for (const paragraph of allParagraphs) {
      if (!paragraphMatchesSection(paragraph.lower, section)) continue;
      const entry = `[${paragraph.source}] ${paragraph.text}`;
      if (sectionLength + entry.length > SECTION_EVIDENCE_LIMIT) break;
      if (totalLength + entry.length > TOTAL_EVIDENCE_LIMIT) break;
      matches.push(entry);
      sectionLength += entry.length;
      totalLength += entry.length;
    }

    if (matches.length > 0) {
      sectionEvidence.push({ section, entries: matches });
    }

    if (totalLength >= TOTAL_EVIDENCE_LIMIT) break;
  }

  if (sectionEvidence.length === 0) return "";

  const parts = sectionEvidence.map(({ section, entries }) =>
    `### ${section}\n${entries.join("\n")}`,
  );

  return `\n## Relevant Excerpts from Uploaded Documents\n\n${parts.join("\n\n")}\n`;
}
