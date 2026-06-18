import { generateWithForcedToolCall, type ToolDefinition } from "@/lib/server/ai";
import { PROTOCOL_SECTION_KEYS, type ProtocolSectionKey } from "@/lib/ai-proposal-types";

export type FileSummary = {
  document_type: string;
  summary: string;
  irb_relevant_facts: string[];
  study_metadata: {
    population: string;
    methodology: string;
    risks: string;
    data_handling: string;
  };
  section_contributions: Record<ProtocolSectionKey, string>;
};

export type ExtractionResult = {
  fileName: string;
  summary: FileSummary | null;
  error: string | null;
};

const PER_FILE_TEXT_CAP = 80_000;

const extractionTool: ToolDefinition = {
  name: "file_extraction",
  description: "Extract structured IRB-relevant information from a single uploaded document",
  parameters: {
    type: "object",
    properties: {
      document_type: {
        type: "string",
        description:
          "Classification: protocol_draft, consent_form, citi_certificate, recruitment_material, survey_instrument, data_collection_tool, irb_approval_letter, cv_biosketch, funding_document, data_safety_plan, spreadsheet_data, or other",
      },
      summary: {
        type: "string",
        description: "2-3 sentence overview of what this document contains",
      },
      irb_relevant_facts: {
        type: "array",
        items: { type: "string" },
        description:
          "Every fact relevant to IRB review: vulnerable populations, risk level, data sensitivity, regulatory triggers, funding sources, multi-site details, etc. Be exhaustive — omissions cause wrong review type predictions.",
      },
      study_metadata: {
        type: "object",
        properties: {
          population: {
            type: "string",
            description: "Target population and any vulnerable groups mentioned. Empty string if not found.",
          },
          methodology: {
            type: "string",
            description: "Research methodology, design, interventions. Empty string if not found.",
          },
          risks: {
            type: "string",
            description: "Risks to participants mentioned or implied. Empty string if not found.",
          },
          data_handling: {
            type: "string",
            description: "Data collection, storage, de-identification, sharing plans. Empty string if not found.",
          },
        },
        required: ["population", "methodology", "risks", "data_handling"],
      },
      section_contributions: {
        type: "object",
        properties: Object.fromEntries(
          PROTOCOL_SECTION_KEYS.map((key) => [
            key,
            {
              type: "string" as const,
              description: `Content from this document relevant to the "${key.replace(/_/g, " ")}" protocol section. Empty string if nothing relevant.`,
            },
          ]),
        ),
        required: [...PROTOCOL_SECTION_KEYS],
      },
    },
    required: ["document_type", "summary", "irb_relevant_facts", "study_metadata", "section_contributions"],
  },
};

const EXTRACTION_SYSTEM = `You are an IRB document analyst. Given a single uploaded file, extract ALL information relevant to human subjects research review. Your extraction feeds directly into review type prediction — every missed detail can cause a wrong categorization.

Be thorough and exhaustive. Include:
- Exact population details (ages, conditions, vulnerable groups)
- Risk indicators (interventions, sensitive topics, deception, biological samples)
- Regulatory triggers (FDA-regulated, multi-site, international, prisoners, children, pregnant women)
- Data sensitivity signals (PHI, identifiable data, genetic data, substance use data)
- Training certifications and their expiration dates
- Funding sources and grant details
- Any approval letters, amendments, or prior IRB decisions

If the document is a certificate, spreadsheet, or administrative form, still extract every detail — these often contain critical compliance signals.`;

export async function extractFileSummary(file: { name: string; text: string }): Promise<ExtractionResult> {
  const truncatedText =
    file.text.length > PER_FILE_TEXT_CAP ? file.text.slice(0, PER_FILE_TEXT_CAP) : file.text;

  try {
    const result = await generateWithForcedToolCall<FileSummary>("file-extraction", {
      systemInstruction: EXTRACTION_SYSTEM,
      history: [],
      userText: `Document name: ${file.name}\n\n---\n${truncatedText}\n---\n\nExtract all IRB-relevant information from this document. Miss nothing.`,
      tool: extractionTool,
      maxOutputTokens: 4096,
    });

    return { fileName: file.name, summary: result, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    console.error(`[extract-file-summary] Failed for "${file.name}":`, message);
    return { fileName: file.name, summary: null, error: message };
  }
}

export function mergeExtractionResults(results: ExtractionResult[]): string {
  const succeeded = results.filter((r): r is ExtractionResult & { summary: FileSummary } => r.summary !== null);
  const failed = results.filter((r) => r.summary === null);

  const parts: string[] = [];

  parts.push(`## Document inventory (${succeeded.length} of ${results.length} files analyzed)\n`);

  for (const result of succeeded) {
    parts.push(
      `- **${result.fileName}** [${result.summary.document_type}]: ${result.summary.summary}`,
    );
  }

  if (failed.length > 0) {
    parts.push(
      `\n⚠ Could not extract: ${failed.map((f) => f.fileName).join(", ")}`,
    );
  }

  parts.push("\n## Consolidated IRB-relevant facts\n");
  const allFacts = new Set<string>();
  for (const result of succeeded) {
    for (const fact of result.summary.irb_relevant_facts) {
      if (fact.trim()) allFacts.add(fact.trim());
    }
  }
  for (const fact of allFacts) {
    parts.push(`- ${fact}`);
  }

  parts.push("\n## Study metadata (merged across documents)\n");
  const metadataFields = ["population", "methodology", "risks", "data_handling"] as const;
  for (const field of metadataFields) {
    const contributions = succeeded
      .map((r) => r.summary.study_metadata[field])
      .filter((v) => v.trim().length > 0);
    if (contributions.length > 0) {
      parts.push(`### ${field.replace(/_/g, " ")}`);
      for (const contribution of contributions) {
        parts.push(contribution);
      }
    }
  }

  parts.push("\n## Per-section contributions\n");
  for (const sectionKey of PROTOCOL_SECTION_KEYS) {
    const contributions = succeeded
      .map((r) => ({
        fileName: r.fileName,
        content: r.summary.section_contributions[sectionKey],
      }))
      .filter((c) => c.content.trim().length > 0);

    if (contributions.length > 0) {
      parts.push(`### ${sectionKey.replace(/_/g, " ")}`);
      for (const contribution of contributions) {
        parts.push(`[From ${contribution.fileName}] ${contribution.content}`);
      }
    }
  }

  return parts.join("\n");
}
