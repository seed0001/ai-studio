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
      songUrl: `/jobs/${jobId}/song.${song.format}`,
      sceneDurationSeconds: sceneDuration,
      scenes: descriptions.map((description, index) => ({
        index,
        description,
        status: "idle" as const,
        takes: [],
        approvedTakeIndex: null,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Planning failed";
    console.error(`[video] planning failed for job ${jobId}:`, err);
    updateJob(jobId, { status: "failed", error: message });
  }
}

/** Generates one new take for one scene. Scene 0 has no reference image
 * (it establishes the look); every other scene is anchored to a frame
 * extracted from scene 0's *currently* approved take, re-extracted fresh
 * each call so switching scene 0's approved take affects future
 * regenerations of other scenes without touching already-generated ones. */
export async function generateScene(jobId: string, sceneIndex: number): Promise<void> {
  const job = getJob(jobId);
  const scene = job?.scenes[sceneIndex];
  if (!job || !scene) throw new Error("Scene not found");

  updateScene(jobId, sceneIndex, { status: "generating", error: undefined });

  try {
    let referenceImage: Buffer | undefined;
    if (sceneIndex > 0) {
      const anchor = job.scenes[0];
      const anchorTake =
        anchor.approvedTakeIndex !== null ? anchor.takes[anchor.approvedTakeIndex] : undefined;
      if (!anchorTake) {
        throw new Error("Generate scene 1 first — later scenes anchor to its reference frame");
      }
      const anchorPath = takeFilePath(jobId, anchorTake.videoUrl);
      referenceImage = await extractFrame(anchorPath, (job.sceneDurationSeconds ?? 10) / 2);
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

/** Generates a first take for every scene that doesn't have one yet.
 * Scene 0 always runs first since later scenes need its reference frame. */
export async function generateAllScenes(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  const pending = job.scenes.filter((scene) => scene.takes.length === 0).map((scene) => scene.index);
  if (pending.length === 0) return;

  if (pending.includes(0)) {
    await generateScene(jobId, 0);
  }
  const rest = pending.filter((index) => index !== 0);
  await Promise.allSettled(rest.map((index) => generateScene(jobId, index)));
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
