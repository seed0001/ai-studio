import type {
  VideoJobStatus,
  VideoPollResult,
  VideoProvider,
  VideoSceneParams,
} from "@/lib/video/provider";

const VIDEOS_URL = "https://openrouter.ai/api/v1/videos";
const MODELS_URL = "https://openrouter.ai/api/v1/videos/models";

interface OpenRouterVideoModelInfo {
  id: string;
  supported_durations?: number[];
}

interface OpenRouterVideoSubmitResponse {
  id?: string;
  polling_url?: string;
  status?: string;
  error?: { message: string };
}

interface OpenRouterVideoPollResponse {
  status?: VideoJobStatus;
  id?: string;
  unsigned_urls?: string[];
  error?: { message: string };
}

export class OpenRouterVideoProvider implements VideoProvider {
  private apiKey: string;

  constructor(apiKey = process.env.OPENROUTER_API_KEY) {
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }
    this.apiKey = apiKey;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "AI Studio",
    };
  }

  async getSupportedDurations(model: string): Promise<number[]> {
    const response = await fetch(MODELS_URL, { headers: this.headers() });
    if (!response.ok) {
      // If capability discovery fails, fall back to a conservative common value
      // rather than blocking generation entirely.
      return [10];
    }

    const json = (await response.json()) as
      | { data?: OpenRouterVideoModelInfo[] }
      | OpenRouterVideoModelInfo[];

    const models = Array.isArray(json) ? json : (json.data ?? []);
    const info = models.find((m) => m.id === model);
    return info?.supported_durations?.length ? info.supported_durations : [10];
  }

  async submitScene({
    prompt,
    model,
    durationSeconds,
    referenceImage,
  }: VideoSceneParams): Promise<{ jobId: string }> {
    const body: Record<string, unknown> = {
      model,
      prompt,
      duration: durationSeconds,
    };

    if (referenceImage) {
      body.input_references = [
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${referenceImage.toString("base64")}`,
          },
        },
      ];
    }

    const response = await fetch(VIDEOS_URL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    const json = (await response.json()) as OpenRouterVideoSubmitResponse;

    if (!response.ok || !json.id) {
      throw new Error(
        json.error?.message ?? `OpenRouter video submit failed (${response.status})`,
      );
    }

    return { jobId: json.id };
  }

  async pollScene(jobId: string): Promise<VideoPollResult> {
    const response = await fetch(`${VIDEOS_URL}/${jobId}`, {
      headers: this.headers(),
    });

    const json = (await response.json()) as OpenRouterVideoPollResponse;

    if (!response.ok) {
      throw new Error(json.error?.message ?? `Poll failed (${response.status})`);
    }

    if (json.status !== "completed") {
      return { status: json.status ?? "pending", error: json.error?.message };
    }

    const videoUrl = json.unsigned_urls?.[0];
    if (!videoUrl) {
      return { status: "failed", error: "Completed job had no video URL" };
    }

    const videoResponse = await fetch(videoUrl, { headers: this.headers() });
    if (!videoResponse.ok) {
      return {
        status: "failed",
        error: `Failed to download video (${videoResponse.status})`,
      };
    }

    const video = Buffer.from(await videoResponse.arrayBuffer());
    return { status: "completed", video };
  }
}
