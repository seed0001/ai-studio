import type {
  MusicGenerationParams,
  MusicGenerationResult,
  MusicProvider,
} from "@/lib/music/provider";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterStreamChunk {
  choices?: Array<{
    delta?: {
      audio?: {
        data?: string;
        format?: string;
        id?: string;
      };
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
        // Audio-output models on OpenRouter reject non-streaming requests
        // ("Audio output requires stream: true") — the audio comes back as
        // base64 chunks spread across SSE deltas that we reassemble below.
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      let message = `OpenRouter request failed (${response.status})`;
      try {
        message = (JSON.parse(text) as { error?: { message: string } }).error
          ?.message ?? message;
      } catch {
        if (text) message = text.slice(0, 500);
      }
      throw new Error(message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const audioChunks: Buffer[] = [];
    let format: string | undefined;
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;

        let chunk: OpenRouterStreamChunk;
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }

        if (chunk.error) {
          throw new Error(chunk.error.message);
        }

        const audio = chunk.choices?.[0]?.delta?.audio;
        if (audio?.data) {
          audioChunks.push(Buffer.from(audio.data, "base64"));
        }
        if (audio?.format) {
          format = audio.format;
        }
      }
    }

    if (audioChunks.length === 0) {
      throw new Error("OpenRouter response did not include audio data");
    }

    return {
      audio: Buffer.concat(audioChunks),
      format: format ?? "mp3",
    };
  }
}
