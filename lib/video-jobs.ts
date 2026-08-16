export interface VideoJob {
  id: string;
  status: "running" | "completed" | "failed";
  stage: string;
  videoUrl?: string;
  error?: string;
  createdAt: number;
}

const JOB_TTL_MS = 60 * 60 * 1000;

// Kept on globalThis so it survives Next.js dev-mode module reloads. In
// production this is just a plain module-level singleton for the life of
// the (single, always-on) container — a job in flight is lost if the
// container restarts mid-run, which is an accepted tradeoff for not having
// a database.
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

export function createJob(id: string): VideoJob {
  pruneExpired();
  const job: VideoJob = {
    id,
    status: "running",
    stage: "Starting…",
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
