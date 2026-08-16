import { mkdir, readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// Deliberately outside public/ — Next's static file serving for public/
// appears to work off a build-time snapshot and won't serve files written
// at runtime, so these are served through explicit route handlers
// (app/songs/[filename]/route.ts, app/videos/[filename]/route.ts).
const DATA_DIR = path.join(process.cwd(), "data");

interface FileStore {
  save(data: Buffer, format: string): Promise<string>;
  filePath(filename: string): string;
}

function createFileStore(subdir: string, urlPrefix: string, maxFiles: number): FileStore {
  const dir = path.join(DATA_DIR, subdir);

  async function enforceRetention() {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile());
    if (files.length <= maxFiles) return;

    const withTimes = await Promise.all(
      files.map(async (entry) => {
        const info = await stat(path.join(dir, entry.name));
        return { name: entry.name, mtime: info.mtimeMs };
      }),
    );

    withTimes.sort((a, b) => a.mtime - b.mtime);

    const toDelete = withTimes.slice(0, withTimes.length - maxFiles);
    await Promise.all(toDelete.map((file) => unlink(path.join(dir, file.name))));
  }

  return {
    async save(data: Buffer, format: string): Promise<string> {
      await mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}.${format}`;
      await writeFile(path.join(dir, filename), data);
      await enforceRetention();
      return `/${urlPrefix}/${filename}`;
    },
    filePath(filename: string): string {
      return path.join(dir, filename);
    },
  };
}

const songs = createFileStore("songs", "songs", 3);
const videos = createFileStore("videos", "videos", 2);

export const saveAudio = songs.save;
export const songPath = songs.filePath;

export const saveVideo = videos.save;
export const videoPath = videos.filePath;
