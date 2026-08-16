import { mkdir, readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const SONGS_DIR = path.join(process.cwd(), "public", "songs");
const MAX_SONGS = 3;

export async function saveAudio(audio: Buffer, format: string): Promise<string> {
  await mkdir(SONGS_DIR, { recursive: true });

  const filename = `${randomUUID()}.${format}`;
  await writeFile(path.join(SONGS_DIR, filename), audio);

  await enforceRetention();

  return `/songs/${filename}`;
}

async function enforceRetention() {
  const entries = await readdir(SONGS_DIR);
  if (entries.length <= MAX_SONGS) return;

  const withTimes = await Promise.all(
    entries.map(async (name) => {
      const info = await stat(path.join(SONGS_DIR, name));
      return { name, mtime: info.mtimeMs };
    }),
  );

  withTimes.sort((a, b) => a.mtime - b.mtime);

  const toDelete = withTimes.slice(0, withTimes.length - MAX_SONGS);
  await Promise.all(
    toDelete.map((file) => unlink(path.join(SONGS_DIR, file.name))),
  );
}
