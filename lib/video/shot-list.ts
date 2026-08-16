const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const SHOT_LIST_MODEL = "anthropic/claude-haiku-4.5";

function extractJsonArray(text: string): unknown[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[0]);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Turns one creative prompt into `sceneCount` distinct scene descriptions —
 * without this, every scene gets essentially the same content prompt and
 * the video model has no reason to vary what it generates from scene to
 * scene, producing a visually repetitive result even once clips are
 * correctly stitched together.
 */
export async function generateShotList(
  basePrompt: string,
  sceneCount: number,
): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const instructions = `You are storyboarding a short music video. The concept: "${basePrompt}"

Break this into exactly ${sceneCount} distinct sequential scene descriptions for a continuous music video. Each scene must describe a different specific moment, camera angle, action, or composition — vary what's actually happening or how it's shot from scene to scene — while keeping the same character(s), setting, and overall visual style/mood consistent throughout.

Respond with ONLY a JSON array of exactly ${sceneCount} strings, each a self-contained scene description. No other text, no markdown code fences.`;

  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "AI Studio",
    },
    body: JSON.stringify({
      model: SHOT_LIST_MODEL,
      messages: [{ role: "user", content: instructions }],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Shot list generation failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  const parsed = extractJsonArray(text);

  if (
    !parsed ||
    parsed.length !== sceneCount ||
    !parsed.every((item) => typeof item === "string" && item.trim().length > 0)
  ) {
    throw new Error(
      `Shot list response was not a valid array of ${sceneCount} scene descriptions: ${text.slice(0, 300)}`,
    );
  }

  return parsed as string[];
}
