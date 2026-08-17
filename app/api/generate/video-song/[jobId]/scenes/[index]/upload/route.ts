import { NextRequest, NextResponse } from "next/server";
import { getJob, addTake, updateScene } from "@/lib/video-jobs";
import { saveJobTake } from "@/lib/job-storage";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

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
  if (scene.status === "generating") {
    return NextResponse.json({ error: "Scene is already generating" }, { status: 409 });
  }

  const form = await req.formData();
  const video = form.get("video");
  if (!(video instanceof File) || video.size === 0) {
    return NextResponse.json({ error: "A video file is required" }, { status: 400 });
  }
  if (video.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "Video file is too large (200MB max)" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(video.type)) {
    return NextResponse.json(
      { error: "Unsupported video format — use mp4, mov, webm, or mkv" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await video.arrayBuffer());
  const takeIndex = scene.takes.length;
  const { url } = await saveJobTake(jobId, sceneIndex, takeIndex, buffer);
  addTake(jobId, sceneIndex, url);
  updateScene(jobId, sceneIndex, { status: "idle", error: undefined });

  return NextResponse.json({ job: getJob(jobId) });
}
