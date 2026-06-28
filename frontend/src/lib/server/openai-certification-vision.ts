import pdf from "pdf-parse";
import type { CertificationExtractedMetadata, ComplianceCertificationType } from "@/lib/types";
import { generateWithForcedToolCall } from "@/lib/server/ai/router";
import type { ToolDefinition } from "@/lib/server/ai/types";

export type { CertificationExtractedMetadata };

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

const EXTRACTION_TOOL: ToolDefinition = {
  name: "certification_metadata",
  description: "Extracted metadata from a compliance training certificate",
  parameters: {
    type: "object",
    properties: {
      certification_type: {
        type: "string",
        enum: CERTIFICATION_TYPES,
      },
      title: { type: "string", description: "Course or module name" },
      trainee_name: { type: "string", description: "Full name of the trainee" },
      issued_at: { type: "string", description: "ISO date YYYY-MM-DD or empty" },
      expires_at: { type: "string", description: "ISO date YYYY-MM-DD or empty" },
      issuing_organization: { type: "string", description: "Issuing org name" },
      certificate_number: { type: "string", description: "Completion ID or record number" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      notes: { type: "string", description: "Brief note about ambiguity, or empty" },
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
  },
};

function normalizeDate(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = Date.parse(`${trimmed}T12:00:00`);
  if (!Number.isFinite(parsed)) return null;
  return trimmed;
}

function sanitizeExtracted(input: Record<string, string>): CertificationExtractedMetadata {
  const certType = input.certification_type as ComplianceCertificationType;
  const type = CERTIFICATION_TYPES.includes(certType) ? certType : "other";
  const conf = input.confidence as "high" | "medium" | "low";
  return {
    certification_type: type,
    title: input.title?.trim().slice(0, 200) || null,
    trainee_name: input.trainee_name?.trim().slice(0, 200) || null,
    issued_at: normalizeDate(input.issued_at),
    expires_at: normalizeDate(input.expires_at),
    issuing_organization: input.issuing_organization?.trim().slice(0, 200) || null,
    certificate_number: input.certificate_number?.trim().slice(0, 100) || null,
    confidence: conf === "high" || conf === "low" ? conf : "medium",
    notes: input.notes?.trim().slice(0, 500) || null,
  };
}

function extractFromText(text: string, fileName: string): Promise<CertificationExtractedMetadata> {
  return generateWithForcedToolCall<Record<string, string>>(
    "file-extraction",
    {
      systemInstruction: EXTRACTION_SYSTEM,
      history: [],
      userText: `Extract metadata from this compliance training certificate (${fileName}).\n\nDocument text:\n\n---\n${text.slice(0, 12000)}\n---`,
      tool: EXTRACTION_TOOL,
      maxOutputTokens: 1200,
    },
  ).then(sanitizeExtracted);
}

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function extractCertificationMetadata(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<CertificationExtractedMetadata> {
  const { buffer, mimeType, fileName } = params;
  const lower = fileName.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");

  if (IMAGE_MIMES.has(mimeType)) {
    return extractFromImage(buffer, mimeType, fileName);
  }

  if (isPdf) {
    const data = await pdf(buffer);
    const text = (data.text || "").trim();

    if (text.length >= 40) {
      return extractFromText(text, fileName);
    }

    throw new Error(
      "This PDF appears to be scanned or image-only. Upload a PNG or JPEG screenshot of the certificate for automatic extraction.",
    );
  }

  throw new Error("Unsupported file type for analysis.");
}

function getFoundryConfig(): { endpoint: string; apiKey: string } {
  const endpoint = process.env.AZURE_ARBITER_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_ARBITER_API_KEY?.trim();
  if (!endpoint || !apiKey) {
    throw new Error("AZURE_ARBITER_ENDPOINT and AZURE_ARBITER_API_KEY must be set for image certificate extraction");
  }
  return { endpoint, apiKey };
}

async function extractFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<CertificationExtractedMetadata> {
  const { endpoint, apiKey } = getFoundryConfig();
  let base = endpoint.replace(/\/+$/, "");
  base = base.replace(/\/api\/projects\/[^/]+.*$/, "");

  const base64 = imageBuffer.toString("base64");

  const jsonSchema = {
    name: "certification_metadata",
    strict: true,
    schema: {
      type: "object",
      properties: {
        certification_type: { type: "string", enum: [...CERTIFICATION_TYPES] },
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
        "certification_type", "title", "trainee_name", "issued_at",
        "expires_at", "issuing_organization", "certificate_number",
        "confidence", "notes",
      ],
      additionalProperties: false,
    },
  };

  const response = await fetch(`${base}/openai/v1/chat/completions?api-version=v1`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "model-router",
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM },
        {
          role: "user",
          content: [
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
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: jsonSchema },
      max_tokens: 1200,
    }),
  });

  const json = (await response.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!response.ok) {
    throw new Error(json.error?.message || `Azure Foundry request failed (${response.status})`);
  }

  const text = json.choices?.[0]?.message?.content;
  if (!text?.trim()) {
    throw new Error("Empty model response");
  }

  const parsed = JSON.parse(text) as Record<string, string>;
  return sanitizeExtracted(parsed);
}
