import { NextResponse } from "next/server";
import type { AiChatMessage, ComplianceFlag, ProtocolDraft } from "@/lib/ai-proposal-types";
import { formatSupplementaryContextForModel, type SupplementaryContextPayload } from "@/lib/ai-context";
import { generateMultiTurnText } from "@/lib/server/gemini";
import { loadInstitutionGuidanceForModel } from "@/lib/institution-guidance-server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const MAX_CONSENT_SNIP = 3500;
const MAX_FLAGS = 24;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      messages?: AiChatMessage[];
      user_message?: string;
      protocol?: ProtocolDraft;
      supplementary_context?: SupplementaryContextPayload;
      compliance_flags?: ComplianceFlag[];
      revision_suggestions?: string[];
      consent_markdown?: string | null;
      suggested_title?: string;
    };
    const user_message = String(body.user_message ?? "").trim();
    if (!user_message) {
      return NextResponse.json({ error: "user_message required" }, { status: 400 });
    }

    const prior: AiChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const protocol = body.protocol ?? ({} as ProtocolDraft);
    const flags = Array.isArray(body.compliance_flags) ? body.compliance_flags.slice(0, MAX_FLAGS) : [];
    const rev = Array.isArray(body.revision_suggestions) ? body.revision_suggestions : [];
    const consent = String(body.consent_markdown ?? "").trim();
    const consentSnip =
      consent.length > MAX_CONSENT_SNIP ? `${consent.slice(0, MAX_CONSENT_SNIP)}\n…` : consent;

    const extra = formatSupplementaryContextForModel(
      body.supplementary_context ?? { notes: "", attachments: [] },
    );

    const supabase = await createServerSupabaseClient();
    const institutionGuidance = await loadInstitutionGuidanceForModel(supabase);

    const systemInstruction = `You are Arbiter's IRB assistant for researchers who **uploaded** their own study protocols or documents. Their uploaded files are the source of truth; you must not invent study facts.

${institutionGuidance}

You help them understand:
- Compliance flags and regulations (plain language)
- The draft consent form (if generated) and what might be missing
- Suggested revisions or clarifications
- How to strengthen their proposal for IRB

Use Markdown (short headings, bullets). Be concise. If the context does not support an answer, say what is missing.

**Static context (may be truncated):**

**Study title (working):** ${String(body.suggested_title ?? "").trim() || "—"}

**AI section notes** (observations from their materials — NOT a replacement for their files):
${JSON.stringify(protocol, null, 2)}

**Compliance flags (${flags.length}):**
${JSON.stringify(
      flags.map((f) => ({
        severity: f.severity,
        section: f.section_key,
        message: f.message,
        cfr: f.cfr_reference,
        actionable: f.actionable,
      })),
      null,
      2,
    )}

**Revision suggestions (${rev.length}):**
${rev.length ? rev.map((s, i) => `${i + 1}. ${s}`).join("\n") : "(none yet)"}

**Consent draft excerpt (if any):**
${consentSnip ? consentSnip : "(not generated yet)"}
${extra}`;

    const reply = await generateMultiTurnText({
      systemInstruction,
      history: prior,
      userText: user_message,
      temperature: 0.35,
      maxOutputTokens: 4096,
    });

    return NextResponse.json({ assistant_message: reply });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Assistant request failed" },
      { status: 500 },
    );
  }
}
