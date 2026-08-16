import { mkdir, readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// Deliberately outside public/ — Next's static file serving for public/
// appears to work off a build-time snapshot and won't serve files written
// at runtime, so these are served through app/songs/[filename]/route.ts.
const SONGS_DIR = path.join(process.cwd(), "data", "songs");
const MAX_SONGS = 3;

export async function saveAudio(audio: Buffer, format: string): Promise<string> {
  await mkdir(SONGS_DIR, { recursive: true });

  const filename = `${randomUUID()}.${format}`;
  await writeFile(path.join(SONGS_DIR, filename), audio);

  await enforceRetention();

  return `/songs/${filename}`;
}

async function enforceRetention() {
  const entries = await readdir(SONGS_DIR, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  if (files.length <= MAX_SONGS) return;

  const withTimes = await Promise.all(
    files.map(async (entry) => {
      const info = await stat(path.join(SONGS_DIR, entry.name));
      return { name: entry.name, mtime: info.mtimeMs };
    }),
  );

  withTimes.sort((a, b) => a.mtime - b.mtime);

  const toDelete = withTimes.slice(0, withTimes.length - MAX_SONGS);
  await Promise.all(
    toDelete.map((file) => unlink(path.join(SONGS_DIR, file.name))),
  );
}

export function songPath(filename: string): string {
  return path.join(SONGS_DIR, filename);
}
