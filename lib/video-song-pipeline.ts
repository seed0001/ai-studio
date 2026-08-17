import path from "path";
import { readFile, unlink } from "fs/promises";
import { getMusicModel } from "@/lib/music/models";
import { OpenRouterMusicProvider } from "@/lib/music/openrouter";
import { DEFAULT_VIDEO_MODEL } from "@/lib/video/models";
import { OpenRouterVideoProvider } from "@/lib/video/openrouter";
import type { VideoProvider } from "@/lib/video/provider";
import { concatAndMux, extractFrame, probeDuration } from "@/lib/ffmpeg";
import { saveVideo } from "@/lib/storage";
import { jobFilePath, saveJobSong, saveJobTake } from "@/lib/job-storage";
import { addTake, getJob, updateJob, updateScene, type VideoJob } from "@/lib/video-jobs";
import { generateShotList } from "@/lib/video/shot-list";

const TARGET_SCENE_SECONDS = 10;
const MAX_SCENES = 24;
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

async function waitForScene(provider: VideoProvider, remoteJobId: string): Promise<Buffer> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await provider.pollScene(remoteJobId);
    console.log(`[video] scene ${remoteJobId} status=${result.status}`);
    if (result.status === "completed" && result.video) {
      return result.video;
    }
    if (result.status === "failed" || result.status === "cancelled" || result.status === "expired") {
      throw new Error(result.error ?? `Scene generation ${result.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error("Scene generation timed out");
}

function pickSceneDuration(supported: number[]): number {
  return supported.reduce((closest, candidate) =>
    Math.abs(candidate - TARGET_SCENE_SECONDS) < Math.abs(closest - TARGET_SCENE_SECONDS)
      ? candidate
      : closest,
  );
}

function scenePrompt(description: string, index: number, total: number): string {
  const continuity =
    index === 0
      ? `This is the opening scene (1 of ${total}) of a continuous music video — establish the character(s) and visual style clearly.`
      : `This is scene ${index + 1} of ${total} in the same continuous music video — match the character appearance and visual style established in the reference image exactly, while depicting this specific moment.`;
  return `${description}\n\n${continuity}`;
}

function takeFilePath(jobId: string, videoUrl: string): string {
  return jobFilePath(jobId, path.basename(videoUrl));
}

/** Shared by both the generated-song and uploaded-song paths: once the song
 * audio is on disk, probe its real duration, split it into scenes, and ask
 * the shot-list model for a distinct description per scene. */
async function planScenesFromAudio(jobId: string, audioPath: string, songUrl: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  const duration = await probeDuration(audioPath);
  console.log(`[video] song duration=${duration}s`);

  const videoProvider = new OpenRouterVideoProvider();
  const supportedDurations = await videoProvider.getSupportedDurations(DEFAULT_VIDEO_MODEL.id);
  const sceneDuration = pickSceneDuration(supportedDurations);
  const sceneCount = Math.min(MAX_SCENES, Math.max(1, Math.ceil(duration / sceneDuration)));
  console.log(
    `[video] supportedDurations=${JSON.stringify(supportedDurations)} sceneDuration=${sceneDuration} sceneCount=${sceneCount}`,
  );

  updateJob(jobId, { stage: "Planning scenes…" });
  let descriptions: string[];
  try {
    descriptions = await generateShotList(job.prompt, sceneCount);
    console.log(`[video] shot list: ${JSON.stringify(descriptions)}`);
  } catch (err) {
    console.error("[video] shot list generation failed, falling back to one repeated description", err);
    descriptions = Array(sceneCount).fill(job.prompt) as string[];
  }

  updateJob(jobId, {
    status: "ready",
    stage: "Ready for review",
    songUrl,
    sceneDurationSeconds: sceneDuration,
    scenes: descriptions.map((description, index) => ({
      index,
      description,
      status: "idle" as const,
      takes: [],
      approvedTakeIndex: null,
    })),
  });
}

/** Song generation + shot-list planning only — no video generation yet. */
export async function planVideoSong(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  const musicModel = getMusicModel(job.musicModelId);
  if (!musicModel) {
    updateJob(jobId, { status: "failed", error: "Unknown music model" });
    return;
  }

  try {
    updateJob(jobId, { stage: "Generating song…" });
    const musicProvider = new OpenRouterMusicProvider();
    const song = await musicProvider.generate({ prompt: job.prompt, model: musicModel.id });
    const audioPath = await saveJobSong(jobId, song.audio, song.format);
    await planScenesFromAudio(jobId, audioPath, `/jobs/${jobId}/song.${song.format}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Planning failed";
    console.error(`[video] planning failed for job ${jobId}:`, err);
    updateJob(jobId, { status: "failed", error: message });
  }
}

/** Same as planVideoSong, but for a song file the user uploaded instead of
 * one generated via OpenRouter — skips straight to scene planning. */
export async function planVideoSongFromUpload(
  jobId: string,
  audio: Buffer,
  format: string,
): Promise<void> {
  try {
    updateJob(jobId, { stage: "Processing uploaded song…" });
    const audioPath = await saveJobSong(jobId, audio, format);
    await planScenesFromAudio(jobId, audioPath, `/jobs/${jobId}/song.${format}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Planning failed";
    console.error(`[video] planning failed for job ${jobId}:`, err);
    updateJob(jobId, { status: "failed", error: message });
  }
}

/** Generates one new take for one scene. Scene 0 has no reference image (it
 * establishes the look); every other scene chains from the *immediately
 * preceding* scene's currently-approved take, anchored to a frame pulled
 * from right near its end — not its midpoint — so the next scene picks up
 * visually where the previous one actually left off. Re-extracted fresh
 * each call, so re-approving a different take on scene N-1 affects future
 * regenerations of scene N without touching anything already generated. */
export async function generateScene(jobId: string, sceneIndex: number): Promise<void> {
  const job = getJob(jobId);
  const scene = job?.scenes[sceneIndex];
  if (!job || !scene) throw new Error("Scene not found");

  updateScene(jobId, sceneIndex, { status: "generating", error: undefined });

  try {
    let referenceImage: Buffer | undefined;
    if (sceneIndex > 0) {
      const anchor = job.scenes[sceneIndex - 1];
      const anchorTake =
        anchor.approvedTakeIndex !== null ? anchor.takes[anchor.approvedTakeIndex] : undefined;
      if (!anchorTake) {
        throw new Error(
          `Generate scene ${sceneIndex} first — this scene chains from its ending frame`,
        );
      }
      const anchorPath = takeFilePath(jobId, anchorTake.videoUrl);
      const anchorDuration = await probeDuration(anchorPath);
      // A hair before the true end avoids seeking past the last decodable
      // frame (which can return black/empty output with some encoders).
      const lastFrameAt = Math.max(0, anchorDuration - 0.15);
      referenceImage = await extractFrame(anchorPath, lastFrameAt);
    }

    const videoProvider = new OpenRouterVideoProvider();
    const submit = await videoProvider.submitScene({
      prompt: scenePrompt(scene.description, sceneIndex, job.scenes.length),
      model: DEFAULT_VIDEO_MODEL.id,
      durationSeconds: job.sceneDurationSeconds ?? 10,
      referenceImage,
    });
    const video = await waitForScene(videoProvider, submit.jobId);

    const takeIndex = scene.takes.length;
    const { url } = await saveJobTake(jobId, sceneIndex, takeIndex, video);
    addTake(jobId, sceneIndex, url);
    updateScene(jobId, sceneIndex, { status: "idle" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scene generation failed";
    console.error(`[video] scene ${sceneIndex} failed for job ${jobId}:`, err);
    updateScene(jobId, sceneIndex, { status: "failed", error: message });
    throw err;
  }
}

/** Generates a first take for every scene that doesn't have one yet, in
 * order. Must run sequentially, not in parallel — each scene now chains
 * from the previous scene's ending frame, so scene N can't start until
 * scene N-1 has a take. Stops after the first failure rather than letting
 * every later scene fail too for the same underlying reason. */
export async function generateAllScenes(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  const pending = job.scenes.filter((scene) => scene.takes.length === 0).map((scene) => scene.index);
  if (pending.length === 0) return;

  for (const index of pending) {
    try {
      await generateScene(jobId, index);
    } catch {
      break;
    }
  }
}

/** Concatenates each scene's currently-approved take with the song audio.
 * Idempotent — safe to re-run any time takes change. */
export async function stitchVideo(jobId: string): Promise<void> {
  const job = getJob(jobId) as VideoJob | undefined;
  if (!job) return;

  const missing = job.scenes.filter((scene) => scene.approvedTakeIndex === null);
  if (missing.length > 0) {
    throw new Error(`Scene ${missing[0].index + 1} has no approved take yet`);
  }
  if (!job.songUrl) {
    throw new Error("Song not generated yet");
  }

  updateJob(jobId, { status: "stitching", stage: "Stitching video…" });

  try {
    const audioPath = jobFilePath(jobId, job.songUrl);
    const scenePaths = job.scenes.map((scene) => {
      const take = scene.takes[scene.approvedTakeIndex as number];
      return takeFilePath(jobId, take.videoUrl);
    });

    const finalPath = jobFilePath(jobId, `final-${Date.now()}.mp4`);
    await concatAndMux(scenePaths, audioPath, finalPath);

    const finalBuffer = await readFile(finalPath);
    const videoUrl = await saveVideo(finalBuffer, "mp4");
    await unlink(finalPath).catch(() => {});

    updateJob(jobId, { status: "ready", stage: "Ready for review", finalVideoUrl: videoUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stitching failed";
    console.error(`[video] stitch failed for job ${jobId}:`, err);
    updateJob(jobId, { status: "ready", stage: "Ready for review", error: message });
    throw err;
  }
}
