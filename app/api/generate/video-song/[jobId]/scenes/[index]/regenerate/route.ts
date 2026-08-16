import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/video-jobs";
import { generateScene } from "@/lib/video-song-pipeline";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; index: string }> },
) {
  const { jobId, index } = await params;
  const sceneIndex = Number(index);

  const job = getJob(jobId);
  const scene = job?.scenes[sceneIndex];
  if (!job || !scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }
  if (scene.status === "generating") {
    return NextResponse.json({ error: "Scene is already generating" }, { status: 409 });
  }

  // Fire-and-forget, same as the top-level generate route — the frontend
  // polls the job status endpoint and watches this scene's status field.
  void generateScene(jobId, sceneIndex).catch(() => {
    // generateScene already records the failure on the scene itself.
  });

  return NextResponse.json({ job: getJob(jobId) }, { status: 202 });
}
