import { NextResponse } from "next/server";
import { SchemaType, type FunctionDeclaration, type Schema } from "@google/generative-ai";
import { generateMultiTurnTextStream, generateWithForcedToolCall } from "@/lib/server/gemini";
import type { AiChatMessage, ProtocolDraft } from "@/lib/ai-proposal-types";
import { PROTOCOL_SECTION_KEYS } from "@/lib/ai-proposal-types";
import { formatSupplementaryContextForModel, type SupplementaryContextPayload } from "@/lib/ai-context";
import { loadInstitutionGuidanceForModel } from "@/lib/institution-guidance-server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const INTAKE_SYSTEM = `You are an skilled IRB protocol intake specialist. Conduct a warm, conversational interview (one focused question or short acknowledgment + question per turn). Adapt based on prior answers.

The researcher does not see a separate "protocol snapshot" or structured document UI—only this chat and their Workspace (notes/uploads). Never ask them to "review the snapshot," "check the snapshot," or "review sections in the snapshot." If you need confirmation about procedures, consent, or any topic, ask plainly in this conversation (e.g. "Can you walk through how sessions will run?") or refer to what they wrote in Workspace notes/uploads.

Information to collect and reflect in the protocol:
- Study title and principal investigator
- Research question and objectives
- Study design (survey, observational, experimental, clinical trial, etc.)
- Participant population (age range, inclusion/exclusion, estimated n)
- Recruitment methods
- Data collection procedures
- Sensitive data (PHI, minors, vulnerable populations, deception, etc.)
- Compensation, risks, and benefits

On EVERY turn you MUST call the tool session_update with:
- assistant_reply: your next message to the researcher (professional, clear).
- suggested_title: a concise study title if known, else empty string.
- protocol: complete markdown prose for ALL 8 keys (use [TBD] sparingly when unknown). Keys: background_rationale, study_design, participants, recruitment, procedures, risks_benefits, confidentiality, consent_process.

Integrate new facts; keep prior content unless the user corrects it. Tone: academic / IRB-appropriate.`;

const INTAKE_SYSTEM_STREAM = `You are an skilled IRB protocol intake specialist. Conduct a warm, conversational interview (one focused question or short acknowledgment + question per turn). Adapt based on prior answers.

The researcher does not see a separate "protocol snapshot" or structured document UI—only this chat and their Workspace (notes/uploads). Never ask them to "review the snapshot," "check the snapshot," or "review sections in the snapshot." If you need confirmation about procedures, consent, or any topic, ask plainly in this conversation (e.g. "Can you walk through how sessions will run?") or refer to what they wrote in Workspace notes/uploads.

Keep the tone academic / IRB-appropriate. Reply in plain text or light Markdown.`;

const protocolSchemaProps: Record<string, Schema> = Object.fromEntries(
  PROTOCOL_SECTION_KEYS.map((k) => [k, { type: SchemaType.STRING } as Schema]),
);

const sessionUpdateDeclaration: FunctionDeclaration = {
  name: "session_update",
  description: "Your conversational reply and full protocol snapshot.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      assistant_reply: { type: SchemaType.STRING },
      suggested_title: { type: SchemaType.STRING },
      protocol: {
        type: SchemaType.OBJECT,
        properties: protocolSchemaProps,
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
      }>({
        systemInstruction,
        history: prior,
        userText: user_message,
        declaration: sessionUpdateDeclaration,
        toolName: "session_update",
      });

      const enc = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            // Stream the conversational reply quickly (no tools), while the structured tool call runs.
            for await (const t of generateMultiTurnTextStream({
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
                  error: e instanceof Error ? e.message : "Gemini request failed",
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
    }>({
      systemInstruction,
      history: prior,
      userText: user_message,
      declaration: sessionUpdateDeclaration,
      toolName: "session_update",
    });

    const { assistant_reply, suggested_title, protocol: nextProtocol } = toolInput;

    return NextResponse.json({
      assistant_message: assistant_reply,
      suggested_title: suggested_title || "",
      protocol: nextProtocol,
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Gemini request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
