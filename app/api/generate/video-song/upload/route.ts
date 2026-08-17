import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createJob } from "@/lib/video-jobs";
import { planVideoSongFromUpload } from "@/lib/video-song-pipeline";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

function extFromFile(file: File): string | undefined {
  if (EXT_BY_MIME[file.type]) return EXT_BY_MIME[file.type];
  const match = /\.([a-z0-9]+)$/i.exec(file.name);
  const ext = match?.[1]?.toLowerCase();
  return ext && ["mp3", "wav", "m4a", "ogg", "flac"].includes(ext) ? ext : undefined;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const prompt = form.get("prompt");
  const audio = form.get("audio");

  if (typeof prompt !== "string" || prompt.trim().length < 3) {
    return NextResponse.json(
      { error: "A prompt (used for the video's visual style) is required" },
      { status: 400 },
    );
  }
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "An audio file is required" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio file is too large (50MB max)" }, { status: 400 });
  }
  const format = extFromFile(audio);
  if (!format) {
    return NextResponse.json(
      { error: "Unsupported audio format — use mp3, wav, m4a, ogg, or flac" },
      { status: 400 },
    );
  }

  const jobId = randomUUID();
  createJob(jobId, { prompt, musicModelId: "uploaded" });

  const buffer = Buffer.from(await audio.arrayBuffer());

  // Fire-and-forget, same pattern as the generated-song path — the frontend
  // polls the job status endpoint.
  void planVideoSongFromUpload(jobId, buffer, format);

  return NextResponse.json({ jobId }, { status: 202 });
}
