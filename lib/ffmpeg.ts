import { spawn } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

const FFMPEG = ffmpegPath as string;
const FFPROBE = ffprobeStatic.path;

function run(bin: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);
    const stdout: Buffer[] = [];
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
      } else {
        reject(new Error(`${path.basename(bin)} exited ${code}: ${stderr.slice(-2000)}`));
      }
    });
  });
}

export async function probeDuration(filePath: string): Promise<number> {
  const out = await run(FFPROBE, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(out.toString("utf8")) as {
    format?: { duration?: string };
  };
  const seconds = Number(parsed.format?.duration);
  if (!Number.isFinite(seconds)) {
    throw new Error(`Could not determine duration of ${filePath}`);
  }
  return seconds;
}

export async function extractFrame(
  filePath: string,
  atSeconds: number,
): Promise<Buffer> {
  return run(FFMPEG, [
    "-ss",
    String(atSeconds),
    "-i",
    filePath,
    "-frames:v",
    "1",
    "-f",
    "image2pipe",
    "-vcodec",
    "mjpeg",
    "-",
  ]);
}

const TARGET_WIDTH = 1280;
const TARGET_HEIGHT = 720;

export async function concatAndMux(
  videoPaths: string[],
  audioPath: string,
  outPath: string,
): Promise<void> {
  const scratchDir = await mkdtemp(path.join(tmpdir(), "ai-studio-ffmpeg-"));
  try {
    const concatenatedPath = path.join(scratchDir, "concatenated.mp4");

    // Scene clips can come back with different resolutions/codecs depending
    // on generation mode (text-to-video vs. image-to-video from a reference
    // frame), so a stream-copy concat (`-f concat -c copy`) is fragile —
    // mismatched inputs can produce a "successfully" written file that
    // actually just loops/freezes on the first segment during playback.
    // Normalize every clip to one resolution via filter_complex and
    // re-encode instead.
    const inputArgs = videoPaths.flatMap((p) => ["-i", p]);
    const scaleLabels = videoPaths.map(
      (_, i) =>
        `[${i}:v]scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=decrease,pad=${TARGET_WIDTH}:${TARGET_HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24[v${i}]`,
    );
    const concatInputs = videoPaths.map((_, i) => `[v${i}]`).join("");
    const filterComplex = `${scaleLabels.join(";")};${concatInputs}concat=n=${videoPaths.length}:v=1:a=0[outv]`;

    await run(FFMPEG, [
      "-y",
      ...inputArgs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[outv]",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      concatenatedPath,
    ]);

    await run(FFMPEG, [
      "-y",
      "-i",
      concatenatedPath,
      "-i",
      audioPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-shortest",
      outPath,
    ]);
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
}
