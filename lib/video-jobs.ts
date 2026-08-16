export interface SceneTake {
  index: number;
  videoUrl: string;
  createdAt: number;
}

export interface Scene {
  index: number;
  description: string;
  status: "idle" | "generating" | "failed";
  error?: string;
  takes: SceneTake[];
  approvedTakeIndex: number | null;
}

export interface VideoJob {
  id: string;
  status: "planning" | "ready" | "stitching" | "failed";
  stage: string;
  prompt: string;
  musicModelId: string;
  songUrl?: string;
  sceneDurationSeconds?: number;
  scenes: Scene[];
  finalVideoUrl?: string;
  error?: string;
  createdAt: number;
}

// Long TTL — unlike the old one-shot pipeline, a job now stays alive across
// an entire editing session (review, edit, regenerate takes, re-stitch),
// which can reasonably span hours, not minutes.
const JOB_TTL_MS = 12 * 60 * 60 * 1000;

// Kept on globalThis so it survives Next.js dev-mode module reloads. In
// production this is just a plain module-level singleton for the life of
// the (single, always-on) container — a job in flight is lost if the
// container restarts mid-session, which is an accepted tradeoff for not
// having a database.
const globalForJobs = globalThis as unknown as {
  videoJobs: Map<string, VideoJob> | undefined;
};

const jobs = globalForJobs.videoJobs ?? new Map<string, VideoJob>();
globalForJobs.videoJobs = jobs;

function pruneExpired() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export function createJob(
  id: string,
  params: { prompt: string; musicModelId: string },
): VideoJob {
  pruneExpired();
  const job: VideoJob = {
    id,
    status: "planning",
    stage: "Starting…",
    prompt: params.prompt,
    musicModelId: params.musicModelId,
    scenes: [],
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function updateJob(id: string, patch: Partial<VideoJob>): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
}

export function getJob(id: string): VideoJob | undefined {
  return jobs.get(id);
}

export function listJobIds(): string[] {
  return [...jobs.keys()];
}

export function updateScene(
  jobId: string,
  sceneIndex: number,
  patch: Partial<Scene>,
): void {
  const job = jobs.get(jobId);
  const scene = job?.scenes[sceneIndex];
  if (!scene) return;
  Object.assign(scene, patch);
}

export function addTake(jobId: string, sceneIndex: number, videoUrl: string): SceneTake | undefined {
  const job = jobs.get(jobId);
  const scene = job?.scenes[sceneIndex];
  if (!scene) return undefined;

  const take: SceneTake = {
    index: scene.takes.length,
    videoUrl,
    createdAt: Date.now(),
  };
  scene.takes.push(take);
  scene.approvedTakeIndex = take.index; // newest take is approved by default
  return take;
}
