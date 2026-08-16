import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getMusicModel } from "@/lib/music/models";
import { OpenRouterMusicProvider } from "@/lib/music/openrouter";
import { uploadAudio } from "@/lib/r2";

const requestSchema = z.object({
  prompt: z.string().min(3).max(2000),
  modelId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const model = getMusicModel(parsed.data.modelId);
  if (!model) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }

  try {
    const provider = new OpenRouterMusicProvider();
    const result = await provider.generate({
      prompt: parsed.data.prompt,
      model: model.id,
    });

    const audioUrl = await uploadAudio(
      `generations/${randomUUID()}.${result.format}`,
      result.audio,
      result.format,
    );

    return NextResponse.json({ audioUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
