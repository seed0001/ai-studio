import { leadSheetSchema, type LeadSheet } from "@/lib/score/types";

const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

// Same model family already used for shot lists (lib/video/shot-list.ts).
// Lead sheets are short and mostly mechanical; a small model handles them
// well and keeps latency/cost down. Bump this to a larger model if the ABC
// output starts coming back malformed.
const SCORE_MODEL = "anthropic/claude-haiku-4.5";

function extractJsonObject(text: string): unknown | null {
  // Strip code fences, then take the outermost {...}.
  const unfenced = text.replace(/```(?:json)?/gi, "").trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

const INSTRUCTIONS = `You are a session musician writing a lead sheet (chords + melody) for a song brief.

BRIEF:
"""
{{BRIEF}}
"""

Produce a singable, idiomatic lead sheet that matches the brief's genre, mood, and tempo. If the brief names a tempo or era, honour it. Default to 4/4 unless the style clearly calls for something else (e.g. 3/4 waltz, 6/8 ballad).

Return ONLY a JSON object (no prose, no markdown fences) with this exact shape:
{
  "title": string,                     // short, evocative; invent one if the brief has none
  "keyName": string,                   // e.g. "C major", "A minor", "E Dorian"
  "tempo": number,                     // BPM, integer
  "timeSignature": string,             // e.g. "4/4"
  "capo": number,                      // guitar capo fret, 0 if none
  "sections": [                         // 3-6 sections, e.g. Intro, Verse, Pre-Chorus, Chorus, Bridge, Outro
    { "name": string, "chords": [string, ...] }   // ONE chord symbol per bar, 4-8 bars per section
  ],
  "abc": string,                       // full lead sheet in ABC notation (see rules below)
  "performanceNotes": string           // 1-2 sentences: feel, strumming/voicing, dynamics
}

CHORD SYMBOL RULES:
- Use plain symbols: C, Am, G7, Dm7, Fmaj7, Bdim, Csus4, Cadd9, C/G. No unicode, no spaces inside a symbol.

ABC NOTATION RULES (must be valid abcjs input):
- Header: X:1, then T: (title), C: (optional), M: (time signature), L:1/8, Q:1/4={tempo}, K: (key).
- Body: write the melody with chord symbols in double quotes before the note they land on, e.g. "C"E2 G2 | "G"D4 |
- Use bar lines. Group the tune so it visibly covers every section; you may mark sections with inline fields like [I:...] comments or a "P:" part label, or simply a comment line "% Chorus".
- 16 to 32 bars total is plenty. Keep the melody diatonic and easy to sing.
- Do NOT include lyrics (no w: lines). Do NOT use ABC features beyond notes, rests (z), bar lines, ties, and quoted chord symbols.
- The "abc" value must be a single JSON string with \\n for newlines.

Respond with the JSON object only.`;

export async function generateLeadSheet(brief: string): Promise<LeadSheet> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "AI Studio",
    },
    body: JSON.stringify({
      model: SCORE_MODEL,
      // Nudge toward a raw JSON object; we still parse defensively below.
      response_format: { type: "json_object" },
      messages: [
        { role: "user", content: INSTRUCTIONS.replace("{{BRIEF}}", brief) },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Lead sheet generation failed (${response.status}): ${text.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  const raw = extractJsonObject(content);
  if (!raw) {
    throw new Error(
      `Lead sheet response was not valid JSON: ${content.slice(0, 300)}`,
    );
  }

  const parsed = leadSheetSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `Lead sheet JSON did not match the expected shape: ${issue?.path.join(".")} — ${issue?.message}`,
    );
  }

  return parsed.data;
}
