import type {
  MusicGenerationParams,
  MusicGenerationResult,
  MusicProvider,
} from "@/lib/music/provider";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterChatAudioOutput {
  data: string;
  format?: string;
  id?: string;
}

interface OpenRouterChatCompletionResponse {
  choices?: Array<{
    message?: {
      audio?: OpenRouterChatAudioOutput;
    };
  }>;
  error?: { message: string };
}

export class OpenRouterMusicProvider implements MusicProvider {
  private apiKey: string;

  constructor(apiKey = process.env.OPENROUTER_API_KEY) {
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }
    this.apiKey = apiKey;
  }

  async generate({
    prompt,
    model,
  }: MusicGenerationParams): Promise<MusicGenerationResult> {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "AI Studio",
      },
      body: JSON.stringify({
        model,
        modalities: ["text", "audio"],
        audio: { format: "mp3" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const json = (await response.json()) as OpenRouterChatCompletionResponse;

    if (!response.ok) {
      throw new Error(
        json.error?.message ?? `OpenRouter request failed (${response.status})`,
      );
    }

    const audio = json.choices?.[0]?.message?.audio;
    if (!audio?.data) {
      throw new Error("OpenRouter response did not include audio data");
    }

    return {
      audio: Buffer.from(audio.data, "base64"),
      format: audio.format ?? "mp3",
    };
  }
}
