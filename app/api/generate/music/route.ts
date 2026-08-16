import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InsufficientCreditsError, refundCredits, spendCredits } from "@/lib/credits";
import { getMusicModel } from "@/lib/music/models";
import { OpenRouterMusicProvider } from "@/lib/music/openrouter";
import { uploadAudio } from "@/lib/r2";

const requestSchema = z.object({
  prompt: z.string().min(3).max(2000),
  modelId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const model = getMusicModel(parsed.data.modelId);
  if (!model) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }

  const { prompt } = parsed.data;
  const userId = session.user.id;
  const cost = model.creditsCost;

  const generation = await db.generation.create({
    data: {
      userId,
      type: "MUSIC",
      prompt,
      model: model.id,
      durationSeconds: model.durationSeconds,
      creditsCost: cost,
    },
  });

  try {
    await spendCredits({ userId, amount: cost, generationId: generation.id });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      await db.generation.update({
        where: { id: generation.id },
        data: { status: "FAILED", errorMessage: "Insufficient credits" },
      });
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }
    throw err;
  }

  try {
    const provider = new OpenRouterMusicProvider();
    const result = await provider.generate({ prompt, model: model.id });

    const audioUrl = await uploadAudio(
      `users/${userId}/${generation.id}.${result.format}`,
      result.audio,
      result.format,
    );

    const updated = await db.generation.update({
      where: { id: generation.id },
      data: { status: "COMPLETED", audioUrl },
    });

    return NextResponse.json({ generation: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";

    await refundCredits({ userId, amount: cost, generationId: generation.id });
    await db.generation.update({
      where: { id: generation.id },
      data: { status: "FAILED", errorMessage: message },
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
