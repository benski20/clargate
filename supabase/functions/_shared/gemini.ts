const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function getApiKey(): string {
  return Deno.env.get("GOOGLE_AI_API_KEY")!;
}

export async function generateContent(
  systemPrompt: string,
  userContent: string,
  options: { json?: boolean; temperature?: number } = {},
): Promise<string> {
  const model = "gemini-2.0-flash";
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${getApiKey()}`;

  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userContent }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      ...(options.json ? { responseMimeType: "application/json" } : {}),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

export async function* streamContent(
  systemPrompt: string,
  userContent: string,
  options: { temperature?: number } = {},
): AsyncGenerator<string> {
  const model = "gemini-2.0-flash";
  const url = `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${getApiKey()}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userContent }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.5,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini streaming error: ${res.status} ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        } catch {
          // skip malformed chunks
        }
      }
    }
  }
}
