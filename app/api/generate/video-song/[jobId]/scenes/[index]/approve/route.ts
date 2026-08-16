import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getJob, updateScene } from "@/lib/video-jobs";

const bodySchema = z.object({
  takeIndex: z.number().int().min(0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string; index: string }> },
) {
  const { jobId, index } = await params;
  const sceneIndex = Number(index);

  const job = getJob(jobId);
  const scene = job?.scenes[sceneIndex];
  if (!job || !scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!scene.takes[parsed.data.takeIndex]) {
    return NextResponse.json({ error: "Take not found" }, { status: 404 });
  }

  updateScene(jobId, sceneIndex, { approvedTakeIndex: parsed.data.takeIndex });

  return NextResponse.json({ job: getJob(jobId) });
}
