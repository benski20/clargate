import pdf from "pdf-parse";
import type { CertificationExtractedMetadata, ComplianceCertificationType } from "@/lib/types";

export type { CertificationExtractedMetadata };

const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o";

const CERTIFICATION_TYPES: ComplianceCertificationType[] = [
  "citi_human_subjects",
  "hipaa",
  "biosafety",
  "conflict_of_interest",
  "other",
];

const EXTRACTION_SYSTEM = `You extract structured metadata from research compliance training certificates (CITI, HIPAA, biosafety, conflict of interest, etc.).

Rules:
- certification_type: pick the best match from the allowed enum; use "other" when unclear.
- title: short human-readable label for the certificate (course/module name or completion title).
- trainee_name: full name of the person who completed training, if visible.
- issued_at / expires_at: ISO dates YYYY-MM-DD only when clearly stated; otherwise null.
- issuing_organization: e.g. CITI Program, institution name.
- certificate_number: completion ID, record number, or similar if present.
- confidence: high when fields are clearly legible; medium when inferred; low when mostly guessed.
- notes: brief note about ambiguity or missing fields; null if everything is clear.`;

const JSON_SCHEMA = {
  name: "certification_metadata",
  strict: true,
  schema: {
    type: "object",
    properties: {
      certification_type: {
        type: "string",
        enum: CERTIFICATION_TYPES,
      },
      title: { type: ["string", "null"] },
      trainee_name: { type: ["string", "null"] },
      issued_at: { type: ["string", "null"] },
      expires_at: { type: ["string", "null"] },
      issuing_organization: { type: ["string", "null"] },
      certificate_number: { type: ["string", "null"] },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      notes: { type: ["string", "null"] },
    },
    required: [
      "certification_type",
      "title",
      "trainee_name",
      "issued_at",
      "expires_at",
      "issuing_organization",
      "certificate_number",
      "confidence",
      "notes",
    ],
    additionalProperties: false,
  },
};

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "high" | "low" | "auto" } };

function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = Date.parse(`${trimmed}T12:00:00`);
  if (!Number.isFinite(parsed)) return null;
  return trimmed;
}

function sanitizeExtracted(raw: CertificationExtractedMetadata): CertificationExtractedMetadata {
  const type = CERTIFICATION_TYPES.includes(raw.certification_type)
    ? raw.certification_type
    : "other";
  return {
    certification_type: type,
    title: raw.title?.trim().slice(0, 200) || null,
    trainee_name: raw.trainee_name?.trim().slice(0, 200) || null,
    issued_at: normalizeDate(raw.issued_at),
    expires_at: normalizeDate(raw.expires_at),
    issuing_organization: raw.issuing_organization?.trim().slice(0, 200) || null,
    certificate_number: raw.certificate_number?.trim().slice(0, 100) || null,
    confidence: raw.confidence === "high" || raw.confidence === "low" ? raw.confidence : "medium",
    notes: raw.notes?.trim().slice(0, 500) || null,
  };
}

async function callOpenAIForExtraction(userContent: ContentPart[]): Promise<CertificationExtractedMetadata> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_VISION_MODEL,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: JSON_SCHEMA,
      },
      max_tokens: 1200,
    }),
  });

  const json = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!res.ok) {
    throw new Error(json.error?.message || `OpenAI request failed (${res.status})`);
  }

  const text = json.choices?.[0]?.message?.content;
  if (!text?.trim()) {
    throw new Error("Empty model response");
  }

  const parsed = JSON.parse(text) as CertificationExtractedMetadata;
  return sanitizeExtracted(parsed);
}

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * Extract certificate metadata using GPT vision (images) or GPT + PDF text (text-based PDFs).
 */
export async function extractCertificationMetadata(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<CertificationExtractedMetadata> {
  const { buffer, mimeType, fileName } = params;
  const lower = fileName.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");

  if (IMAGE_MIMES.has(mimeType)) {
    const base64 = buffer.toString("base64");
    return callOpenAIForExtraction([
      {
        type: "text",
        text: `Extract metadata from this compliance training certificate image (${fileName}).`,
      },
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${base64}`,
          detail: "high",
        },
      },
    ]);
  }

  if (isPdf) {
    const data = await pdf(buffer);
    const text = (data.text || "").trim();

    if (text.length >= 40) {
      return callOpenAIForExtraction([
        {
          type: "text",
          text: `Extract metadata from this compliance training certificate. Document text:\n\n---\n${text.slice(0, 12000)}\n---`,
        },
      ]);
    }

    throw new Error(
      "This PDF appears to be scanned or image-only. Upload a PNG or JPEG screenshot of the certificate for automatic extraction.",
    );
  }

  throw new Error("Unsupported file type for analysis.");
}
