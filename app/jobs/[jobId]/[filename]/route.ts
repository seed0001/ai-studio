import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { jobFilePath } from "@/lib/job-storage";

const JOB_ID_PATTERN = /^[a-f0-9-]+$/i;
const FILENAME_PATTERN = /^(scene-\d+-take-\d+\.mp4|song\.(mp3|wav))$/;

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; filename: string }> },
) {
  const { jobId, filename } = await params;

  if (!JOB_ID_PATTERN.test(jobId) || !FILENAME_PATTERN.test(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = filename.split(".").pop()!.toLowerCase();

  try {
    const data = await readFile(jobFilePath(jobId, filename));
    return new NextResponse(data, {
      headers: {
        "Content-Type": CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
