import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/video-jobs";
import { generateAllScenes } from "@/lib/video-song-pipeline";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  void generateAllScenes(jobId).catch(() => {
    // Per-scene failures are recorded on each scene; nothing to do here.
  });

  return NextResponse.json({ job: getJob(jobId) }, { status: 202 });
}
