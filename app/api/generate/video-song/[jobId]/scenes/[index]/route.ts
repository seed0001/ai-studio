import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getJob, updateScene } from "@/lib/video-jobs";

const bodySchema = z.object({
  description: z.string().min(3).max(2000),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string; index: string }> },
) {
  const { jobId, index } = await params;
  const sceneIndex = Number(index);

  const job = getJob(jobId);
  if (!job || !job.scenes[sceneIndex]) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  updateScene(jobId, sceneIndex, { description: parsed.data.description });

  return NextResponse.json({ job: getJob(jobId) });
}
