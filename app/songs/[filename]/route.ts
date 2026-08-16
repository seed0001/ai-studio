import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { songPath } from "@/lib/storage";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

// Generated filenames are always randomUUID() + "." + format (see lib/storage.ts) —
// reject anything else so this can't be used to read arbitrary files.
const FILENAME_PATTERN = /^[a-f0-9-]+\.(mp3|wav)$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  if (!FILENAME_PATTERN.test(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = filename.split(".").pop()!.toLowerCase();

  try {
    const data = await readFile(songPath(filename));
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
