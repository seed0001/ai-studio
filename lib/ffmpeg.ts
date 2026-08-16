import { spawn } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
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

export async function concatAndMux(
  videoPaths: string[],
  audioPath: string,
  outPath: string,
): Promise<void> {
  const scratchDir = await mkdtemp(path.join(tmpdir(), "ai-studio-ffmpeg-"));
  try {
    const listPath = path.join(scratchDir, "concat.txt");
    const listContents = videoPaths
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(listPath, listContents, "utf8");

    const concatenatedPath = path.join(scratchDir, "concatenated.mp4");
    await run(FFMPEG, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
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
