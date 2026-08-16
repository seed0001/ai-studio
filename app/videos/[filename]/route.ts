import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { videoPath } from "@/lib/storage";

// Generated filenames are always randomUUID() + ".mp4" (see lib/storage.ts) —
// reject anything else so this can't be used to read arbitrary files.
const FILENAME_PATTERN = /^[a-f0-9-]+\.mp4$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  if (!FILENAME_PATTERN.test(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = await readFile(videoPath(filename));
    return new NextResponse(data, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
