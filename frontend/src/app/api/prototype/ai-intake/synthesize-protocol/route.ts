import { NextResponse } from "next/server";
import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { generateWithForcedToolCall } from "@/lib/server/gemini";
import { PROTOCOL_SECTION_KEYS, type ProtocolDraft } from "@/lib/ai-proposal-types";
import { loadInstitutionGuidanceForModel } from "@/lib/institution-guidance-server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const protocolDeclaration: FunctionDeclaration = {
  name: "structured_protocol",
  description: "Map unstructured study materials into IRB protocol sections",
  parameters: {
    type: SchemaType.OBJECT,
    properties: Object.fromEntries(
      PROTOCOL_SECTION_KEYS.map((k) => [
        k,
        {
          type: SchemaType.STRING,
          description: `Section: ${k.replace(/_/g, " ")}`,
        },
      ]),
    ),
    required: [...PROTOCOL_SECTION_KEYS],
  },
};

const MAX_INPUT_CHARS = 150_000;

export async function POST(req: Request) {
  try {
    const { raw_text, title, mode } = (await req.json()) as {
      raw_text?: string;
      title?: string;
      /** Upload path: observations & gaps only — do not replace the researcher's source documents */
      mode?: "upload_review" | "full_synthesis";
    };
    const raw = String(raw_text ?? "").trim();
    if (!raw) {
      return NextResponse.json({ error: "raw_text required" }, { status: 400 });
    }

    const truncated = raw.length > MAX_INPUT_CHARS ? raw.slice(0, MAX_INPUT_CHARS) : raw;
    const studyTitle = String(title ?? "").trim() || "Uploaded study";

    const uploadReviewInstructions = `The researcher uploaded ORIGINAL study materials below. Those files are the source of truth and must NOT be rewritten or reformatted by you.

For EACH protocol section key, write **review-style notes** only:
- What the uploaded materials appear to address (brief).
- Gaps, ambiguities, or missing IRB-relevant information.
- Suggested revisions or clarifications the researcher might make (as bullet ideas referencing themes, not re-drafting their prose).
- If a topic is absent, say "Not clearly addressed in the materials."

Use short paragraphs or bullets. Do NOT produce a polished substitute protocol or paste long paraphrases of their document. Quote at most short phrases when necessary.`;

    const fullSynthesisInstructions = `You are mapping uploaded IRB / human-subjects study materials into a structured protocol outline.

Study title (if known): ${studyTitle}

Unstructured materials (may include multiple files concatenated):
---
${truncated}
---

Fill every section with the best available content inferred from the materials. If something is missing, write a short placeholder noting what is missing. Use clear academic language.`;

    const userText =
      mode === "upload_review"
        ? `${uploadReviewInstructions}

Study title (if known): ${studyTitle}

Uploaded materials (excerpt; may be truncated):
---
${truncated}
---`
        : fullSynthesisInstructions;

    const supabase = await createServerSupabaseClient();
    const institutionGuidance = await loadInstitutionGuidanceForModel(supabase);

    const systemBase =
      mode === "upload_review"
        ? `You return structured section notes ONLY via the structured_protocol tool. Each field is AI review commentary for that IRB section—not a replacement document. Never present your output as the researcher's finalized protocol text.${institutionGuidance}`
        : `You return structured protocol sections only via the structured_protocol tool. Never invent study facts not supported by the text; when uncertain, say so briefly in that section.${institutionGuidance}`;

    const result = await generateWithForcedToolCall<ProtocolDraft>({
      systemInstruction: systemBase,
      history: [],
      userText,
      declaration: protocolDeclaration,
      toolName: "structured_protocol",
      maxOutputTokens: 8192,
    });

    const protocol: ProtocolDraft = { ...result };
    for (const k of PROTOCOL_SECTION_KEYS) {
      if (typeof protocol[k] !== "string") {
        (protocol as Record<string, string>)[k] = "";
      }
    }

    return NextResponse.json({ protocol });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Synthesis failed" },
      { status: 500 },
    );
  }
}
