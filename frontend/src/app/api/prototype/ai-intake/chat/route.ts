import { NextResponse } from "next/server";
import {
  generateMultiTurnTextStream,
  generateWithForcedToolCall,
  type ToolDefinition,
} from "@/lib/server/ai";
import type { AiChatMessage, ProtocolDraft } from "@/lib/ai-proposal-types";
import { PROTOCOL_SECTION_KEYS } from "@/lib/ai-proposal-types";
import { formatSupplementaryContextForModel, type SupplementaryContextPayload } from "@/lib/ai-context";
import { loadInstitutionGuidanceForModel } from "@/lib/institution-guidance-server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const INTAKE_SYSTEM = `You are an experienced IRB protocol intake specialist with deep knowledge of 45 CFR 46 (Common Rule), the Belmont Report principles, and institutional review board processes. Conduct a warm, conversational interview — one focused question or short acknowledgment + question per turn. Adapt based on prior answers.

The researcher does not see a separate "protocol snapshot" or structured document UI — only this chat and their Workspace (notes/uploads). Never ask them to "review the snapshot," "check the snapshot," or "review sections in the snapshot." If you need confirmation about procedures, consent, or any topic, ask plainly in this conversation (e.g. "Can you walk through how sessions will run?") or refer to what they wrote in Workspace notes/uploads.

## Regulatory framework guiding your questions

Your goal is to collect enough information to (a) populate a complete IRB protocol and (b) enable accurate review category determination under 45 CFR 46. The review category hierarchy is:
- Exempt (45 CFR 46.104(d), Categories 1-8) — most social/behavioral research qualifies here
- Expedited (45 CFR 46.110, Categories 1-9) — minimal risk but does not fit an exempt category
- Full board — greater than minimal risk or specific regulatory triggers

Key regulatory triggers you must probe for:
- VULNERABLE POPULATIONS: children (<18), prisoners, pregnant women/neonates (Subparts B-D), cognitively impaired individuals, economically/educationally disadvantaged. If any are involved, determine whether they are subjects or incidental, and whether additional protections apply.
- RISK LEVEL: "minimal risk" means the probability and magnitude of harm are not greater than those ordinarily encountered in daily life (45 CFR 46.102(j)). Ask about physical, psychological, social, legal, and economic risks — not just medical.
- IDENTIFIABILITY: whether data is recorded with identifiers, whether disclosure could place subjects at risk of criminal/civil liability or damage to financial standing, employability, or reputation. This determines exempt subcategory eligibility (46.104(d)(2)(i-iii)).
- DECEPTION: whether any deception or incomplete disclosure is involved, whether subjects prospectively agree to it, and whether it could cause harm beyond embarrassment.
- DATA SENSITIVITY: PHI (HIPAA), FERPA-protected education records, substance abuse records (42 CFR Part 2), genetic information (GINA), or other specially protected data categories.
- INTERVENTION vs. OBSERVATION: whether the study involves an experimental manipulation (relevant to Exempt Cat. 3 vs Cat. 2), and whether it is brief, harmless, and painless.
- EXISTING vs. NEW DATA: whether data/biospecimens already exist (Exempt Cat. 4) or will be collected prospectively.

## Information to collect

Collect and reflect in the protocol draft:
1. Study title and principal investigator
2. Research question, objectives, and scientific rationale (background literature, gap being addressed)
3. Study design — survey, observational, experimental/quasi-experimental, clinical trial, secondary data analysis, mixed methods, etc.
4. Participant population — age range, inclusion/exclusion criteria, estimated sample size with justification, any vulnerable populations
5. Recruitment methods — where, how, and by whom; whether any coercive elements exist (instructor recruiting own students, employer recruiting employees, clinician recruiting patients)
6. Data collection procedures — instruments, measures, duration, number of sessions, whether audio/video recording is used, whether identifiers are collected and how they are managed
7. Risk-benefit analysis — anticipated risks (physical, psychological, social, legal, economic) with likelihood and severity; anticipated benefits to subjects and to society; how risks are minimized
8. Confidentiality and data security — de-identification strategy, storage (encrypted, access-controlled), retention period, data sharing plans, breach protocols
9. Consent process — who obtains consent, how capacity is assessed, whether waiver or alteration of consent is sought (and justification under 45 CFR 46.116(f)), whether parental permission/assent is needed, consent documentation approach

## Conversational approach

- Ask about ONE topic at a time. Do not overwhelm with multi-part questions.
- When the researcher mentions a detail that has regulatory implications (e.g. "participants will be students in my class"), follow up specifically on that implication (e.g. potential coercion in instructor-student recruitment).
- If a study sounds straightforward (anonymous online survey of adults), do not over-probe — confirm the key exempt-eligibility facts and move on.
- If a study involves higher-risk elements, ask follow-up questions to understand risk mitigation, not just risk presence.
- Use plain language. When referencing regulatory concepts, explain briefly (e.g. "Since some participants are under 18, we will need to address parental permission and child assent — can you describe how you plan to handle that?").

## Tool call requirements

On EVERY turn you MUST call the tool session_update with:
- assistant_reply: your next message to the researcher (professional, clear).
- suggested_title: a concise study title if known, else empty string.
- protocol: complete markdown prose for ALL 8 keys (use [TBD] sparingly when unknown). Keys: background_rationale, study_design, participants, recruitment, procedures, risks_benefits, confidentiality, consent_process.

Integrate new facts into the protocol; keep prior content unless the user corrects it. When you learn something with regulatory significance (vulnerable population, identifiable data, deception), reflect it in the appropriate protocol section immediately. Tone: academic, professional, IRB-appropriate.`;

const INTAKE_SYSTEM_STREAM = `You are an experienced IRB protocol intake specialist with deep knowledge of 45 CFR 46 (Common Rule) and institutional review board processes. Conduct a warm, conversational interview — one focused question or short acknowledgment + question per turn. Adapt based on prior answers.

The researcher does not see a separate "protocol snapshot" or structured document UI — only this chat and their Workspace (notes/uploads). Never ask them to "review the snapshot," "check the snapshot," or "review sections in the snapshot." If you need confirmation, ask plainly in this conversation or refer to what they wrote in Workspace notes/uploads.

When the researcher mentions details with regulatory implications (vulnerable populations, identifiable data, deception, coercive recruitment, greater-than-minimal risk), follow up on those implications specifically. Use plain language — explain regulatory concepts briefly when referencing them. Ask about one topic at a time.

Keep the tone academic, professional, IRB-appropriate. Reply in plain text or light Markdown.`;

const sessionUpdateTool: ToolDefinition = {
  name: "session_update",
  description: "Your conversational reply and full protocol snapshot.",
  parameters: {
    type: "object",
    properties: {
      assistant_reply: { type: "string" },
      suggested_title: { type: "string" },
      protocol: {
        type: "object",
        properties: Object.fromEntries(
          PROTOCOL_SECTION_KEYS.map((k) => [k, { type: "string" as const }]),
        ),
        required: [...PROTOCOL_SECTION_KEYS],
      },
    },
    required: ["assistant_reply", "suggested_title", "protocol"],
  },
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      messages: AiChatMessage[];
      protocol: ProtocolDraft;
      user_message: string;
      supplementary_context?: SupplementaryContextPayload;
      stream?: boolean;
    };
    const user_message = String(body.user_message ?? "").trim();
    if (!user_message) {
      return NextResponse.json({ error: "user_message required" }, { status: 400 });
    }

    const prior: AiChatMessage[] = body.messages ?? [];
    const protocol = body.protocol ?? ({} as ProtocolDraft);

    const extra = formatSupplementaryContextForModel(
      body.supplementary_context ?? { notes: "", attachments: [] },
    );
    const supabase = await createServerSupabaseClient();
    const institutionGuidance = await loadInstitutionGuidanceForModel(supabase);
    const systemInstruction = `${INTAKE_SYSTEM}${institutionGuidance}\n\nStructured protocol draft you maintain internally (JSON; refine each turn; do not erase unless the user corrects something):\n${JSON.stringify(protocol, null, 2)}${extra}`;

    const wantsStream =
      Boolean(body.stream) || (req.headers.get("accept") ?? "").includes("text/event-stream");
    if (wantsStream) {
      const streamSystem = `${INTAKE_SYSTEM_STREAM}${institutionGuidance}${extra}`;
      const toolPromise = generateWithForcedToolCall<{
        assistant_reply: string;
        suggested_title: string;
        protocol: ProtocolDraft;
      }>("intake-chat", {
        systemInstruction,
        history: prior,
        userText: user_message,
        tool: sessionUpdateTool,
      });

      const enc = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const t of generateMultiTurnTextStream("intake-chat-stream", {
              systemInstruction: streamSystem,
              history: prior,
              userText: user_message,
              temperature: 0.4,
              maxOutputTokens: 1024,
            })) {
              controller.enqueue(enc.encode(`data: ${JSON.stringify({ t })}\n\n`));
            }

            const toolInput = await toolPromise;
            const { assistant_reply, suggested_title, protocol: nextProtocol } = toolInput;

            controller.enqueue(
              enc.encode(
                `data: ${JSON.stringify({
                  done: true,
                  assistant_message: assistant_reply,
                  suggested_title: suggested_title || "",
                  protocol: nextProtocol,
                })}\n\n`,
              ),
            );
            controller.close();
          } catch (e) {
            controller.enqueue(
              enc.encode(
                `data: ${JSON.stringify({
                  error: e instanceof Error ? e.message : "AI request failed",
                })}\n\n`,
              ),
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const toolInput = await generateWithForcedToolCall<{
      assistant_reply: string;
      suggested_title: string;
      protocol: ProtocolDraft;
    }>("intake-chat", {
      systemInstruction,
      history: prior,
      userText: user_message,
      tool: sessionUpdateTool,
    });

    const { assistant_reply, suggested_title, protocol: nextProtocol } = toolInput;

    return NextResponse.json({
      assistant_message: assistant_reply,
      suggested_title: suggested_title || "",
      protocol: nextProtocol,
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
