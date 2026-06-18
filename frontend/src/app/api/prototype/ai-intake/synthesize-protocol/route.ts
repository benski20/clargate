import { NextResponse } from "next/server";
import { generateWithForcedToolCall, type ToolDefinition } from "@/lib/server/ai";
import { PROTOCOL_SECTION_KEYS, type ProtocolDraft } from "@/lib/ai-proposal-types";
import { loadInstitutionGuidanceForModel } from "@/lib/institution-guidance-server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  extractFileSummary,
  mergeExtractionResults,
  type ExtractionResult,
} from "@/lib/server/extract-file-summary";

const protocolTool: ToolDefinition = {
  name: "structured_protocol",
  description: "Map unstructured study materials into IRB protocol sections",
  parameters: {
    type: "object",
    properties: Object.fromEntries(
      PROTOCOL_SECTION_KEYS.map((k) => [
        k,
        {
          type: "string" as const,
          description: `Section: ${k.replace(/_/g, " ")}`,
        },
      ]),
    ),
    required: [...PROTOCOL_SECTION_KEYS],
  },
};

const MAX_INPUT_CHARS = 800_000;

type RequestBody = {
  raw_text?: string;
  files?: { name: string; text: string }[];
  title?: string;
  mode?: "upload_review" | "full_synthesis";
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const studyTitle = String(body.title ?? "").trim() || "Uploaded study";
    const mode = body.mode;
    const files = Array.isArray(body.files) ? body.files : [];

    const useMapReduce = files.length > 0;

    let inputText: string;
    let truncated = false;
    let extractionResults: ExtractionResult[] = [];

    if (useMapReduce) {
      extractionResults = await Promise.all(
        files.map((file) => extractFileSummary(file)),
      );
      inputText = mergeExtractionResults(extractionResults);
    } else {
      const text = String(body.raw_text ?? "").trim();
      if (!text) {
        return NextResponse.json({ error: "raw_text or files required" }, { status: 400 });
      }
      truncated = text.length > MAX_INPUT_CHARS;
      inputText = truncated ? text.slice(0, MAX_INPUT_CHARS) : text;
    }

    const supabase = await createServerSupabaseClient();
    const institutionGuidance = await loadInstitutionGuidanceForModel(supabase);

    const uploadReviewInstructions = useMapReduce
      ? `The researcher uploaded study materials that have been individually analyzed below. This is a structured extraction from ${files.length} documents — every document has been processed.

For EACH protocol section key, write **brief review-style notes** only (3–5 short bullets max per section):
- What the materials appear to address (one line).
- Key gaps or missing IRB-relevant information (group related gaps).
- Up to 2 suggested clarifications the researcher might make.
- If a topic is absent, say "Not clearly addressed in the materials."

Pay special attention to the consolidated IRB-relevant facts and study metadata — these determine the correct review category.

Use markdown lists (one \`- item\` per line, ≤120 chars each). Do NOT use inline bullet characters (•). Do NOT produce a polished substitute protocol or long paraphrases.`
      : `The researcher uploaded ORIGINAL study materials below. Those files are the source of truth and must NOT be rewritten or reformatted by you.

For EACH protocol section key, write **brief review-style notes** only (3–5 short bullets max per section):
- What the materials appear to address (one line).
- Key gaps or missing IRB-relevant information (group related gaps).
- Up to 2 suggested clarifications the researcher might make.
- If a topic is absent, say "Not clearly addressed in the materials."

Use markdown lists (one \`- item\` per line, ≤120 chars each). Do NOT use inline bullet characters (•). Do NOT produce a polished substitute protocol or paste long paraphrases. Quote at most short phrases when necessary.`;

    const fullSynthesisInstructions = `You are mapping uploaded IRB / human-subjects study materials into a structured protocol outline.

Study title (if known): ${studyTitle}

${useMapReduce ? "Structured extraction from uploaded materials" : "Unstructured materials (may include multiple files concatenated)"}:
---
${inputText}
---

Fill every section with the best available content inferred from the materials. If something is missing, write a short placeholder noting what is missing. Use clear academic language.`;

    const userText =
      mode === "upload_review"
        ? `${uploadReviewInstructions}

Study title (if known): ${studyTitle}

${useMapReduce ? "Structured extraction from all uploaded documents" : "Uploaded materials (excerpt; may be truncated)"}:
---
${inputText}
---`
        : fullSynthesisInstructions;

    const systemBase =
      mode === "upload_review"
        ? `You return structured section notes ONLY via the structured_protocol tool. Each field is AI review commentary for that IRB section—not a replacement document. Keep each section concise (short bullets, no essays). Never present your output as the researcher's finalized protocol text. Do NOT use markdown bold (**text**) or italic (*text*) formatting in your output — use plain text only.${institutionGuidance}`
        : `You return structured protocol sections only via the structured_protocol tool. Never invent study facts not supported by the text; when uncertain, say so briefly in that section. Do NOT use markdown bold (**text**) or italic (*text*) formatting in your output — use plain text only.${institutionGuidance}`;

    const result = await generateWithForcedToolCall<ProtocolDraft>("protocol-synthesis", {
      systemInstruction: systemBase,
      history: [],
      userText,
      tool: protocolTool,
      maxOutputTokens: 16384,
    });

    const protocol: ProtocolDraft = { ...result };
    for (const k of PROTOCOL_SECTION_KEYS) {
      if (typeof protocol[k] !== "string") {
        (protocol as Record<string, string>)[k] = "";
      }
    }

    const failedFiles = extractionResults
      .filter((r) => r.summary === null)
      .map((r) => r.fileName);

    return NextResponse.json({
      protocol,
      truncated,
      filesProcessed: useMapReduce ? extractionResults.length : undefined,
      failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Synthesis failed" },
      { status: 500 },
    );
  }
}
