import { mkdir, readdir, rm, stat, writeFile } from "fs/promises";
import path from "path";

// Per-job *working* storage — song + every scene take generated during an
// editing session. Unlike lib/storage.ts (the capped, permanent song/video
// library), this needs to survive across many separate requests over the
// life of one editing session (plan → edit → regenerate → stitch), so it
// can't live in a request-scoped temp dir. Served via
// app/jobs/[jobId]/[filename]/route.ts. Pruned by job count, not file count,
// since a single active job can accumulate many takes.
const JOBS_DIR = path.join(process.cwd(), "data", "jobs");
const MAX_JOB_DIRS = 10;

function dirFor(jobId: string): string {
  return path.join(JOBS_DIR, jobId);
}

async function enforceJobRetention() {
  await mkdir(JOBS_DIR, { recursive: true });
  const entries = await readdir(JOBS_DIR, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory());
  if (dirs.length <= MAX_JOB_DIRS) return;

  const withTimes = await Promise.all(
    dirs.map(async (entry) => {
      const info = await stat(path.join(JOBS_DIR, entry.name));
      return { name: entry.name, mtime: info.mtimeMs };
    }),
  );
  withTimes.sort((a, b) => a.mtime - b.mtime);

  const toDelete = withTimes.slice(0, withTimes.length - MAX_JOB_DIRS);
  await Promise.all(
    toDelete.map((entry) =>
      rm(path.join(JOBS_DIR, entry.name), { recursive: true, force: true }),
    ),
  );
}

export async function saveJobSong(
  jobId: string,
  audio: Buffer,
  format: string,
): Promise<string> {
  const dir = dirFor(jobId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `song.${format}`);
  await writeFile(filePath, audio);
  await enforceJobRetention();
  return filePath;
}

export async function saveJobTake(
  jobId: string,
  sceneIndex: number,
  takeIndex: number,
  video: Buffer,
): Promise<{ path: string; url: string }> {
  const dir = dirFor(jobId);
  await mkdir(dir, { recursive: true });
  const filename = `scene-${sceneIndex}-take-${takeIndex}.mp4`;
  const filePath = path.join(dir, filename);
  await writeFile(filePath, video);
  return { path: filePath, url: `/jobs/${jobId}/${filename}` };
}

export function jobFilePath(jobId: string, filename: string): string {
  return path.join(dirFor(jobId), filename);
}
