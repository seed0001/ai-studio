import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getMusicModel } from "@/lib/music/models";
import { createJob } from "@/lib/video-jobs";
import { planVideoSong } from "@/lib/video-song-pipeline";

const requestSchema = z.object({
  prompt: z.string().min(3).max(8000),
  musicModelId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { prompt, musicModelId } = parsed.data;

  if (!getMusicModel(musicModelId)) {
    return NextResponse.json({ error: "Unknown music model" }, { status: 400 });
  }

  const jobId = randomUUID();
  createJob(jobId, { prompt, musicModelId });

  // Fire-and-forget: this keeps running in the background within the
  // long-lived Node process after we respond. Relies on Railway's
  // always-on container — would not work as-is on a serverless host.
  // This only plans (song + shot list) — actual scene video generation
  // is a separate, explicit step the user triggers after reviewing.
  void planVideoSong(jobId);

  return NextResponse.json({ jobId }, { status: 202 });
}
