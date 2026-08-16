import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/video-jobs";
import { stitchVideo } from "@/lib/video-song-pipeline";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  try {
    await stitchVideo(jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stitching failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ job: getJob(jobId) });
}
