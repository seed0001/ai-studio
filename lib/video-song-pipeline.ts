import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { getMusicModel } from "@/lib/music/models";
import { OpenRouterMusicProvider } from "@/lib/music/openrouter";
import { DEFAULT_VIDEO_MODEL } from "@/lib/video/models";
import { OpenRouterVideoProvider } from "@/lib/video/openrouter";
import type { VideoProvider } from "@/lib/video/provider";
import { concatAndMux, extractFrame, probeDuration } from "@/lib/ffmpeg";
import { saveVideo } from "@/lib/storage";
import { updateJob } from "@/lib/video-jobs";
import { generateShotList } from "@/lib/video/shot-list";

const TARGET_SCENE_SECONDS = 10;
const MAX_SCENES = 24;
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

async function waitForScene(
  provider: VideoProvider,
  jobId: string,
): Promise<Buffer> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await provider.pollScene(jobId);
    console.log(`[video] scene ${jobId} status=${result.status}`);
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

function scenePrompt(sceneDescription: string, index: number, total: number): string {
  const continuity =
    index === 0
      ? `This is the opening scene (1 of ${total}) of a continuous music video — establish the character(s) and visual style clearly.`
      : `This is scene ${index + 1} of ${total} in the same continuous music video — match the character appearance and visual style established in the reference image exactly, while depicting this specific moment.`;
  return `${sceneDescription}\n\n${continuity}`;
}

export async function runVideoSongPipeline(params: {
  jobId: string;
  prompt: string;
  musicModelId: string;
}): Promise<void> {
  const { jobId, prompt, musicModelId } = params;
  const musicModel = getMusicModel(musicModelId);
  if (!musicModel) {
    updateJob(jobId, { status: "failed", error: "Unknown music model" });
    return;
  }

  const scratchDir = await mkdtemp(path.join(tmpdir(), "ai-studio-video-"));

  try {
    updateJob(jobId, { stage: "Generating song…" });
    const musicProvider = new OpenRouterMusicProvider();
    const song = await musicProvider.generate({ prompt, model: musicModel.id });
    const audioPath = path.join(scratchDir, `song.${song.format}`);
    await writeFile(audioPath, song.audio);

    const duration = await probeDuration(audioPath);
    console.log(`[video] song duration=${duration}s`);

    const videoProvider = new OpenRouterVideoProvider();
    const videoModel = DEFAULT_VIDEO_MODEL;
    const supportedDurations = await videoProvider.getSupportedDurations(videoModel.id);
    const sceneDuration = pickSceneDuration(supportedDurations);
    const sceneCount = Math.min(
      MAX_SCENES,
      Math.max(1, Math.ceil(duration / sceneDuration)),
    );
    console.log(
      `[video] supportedDurations=${JSON.stringify(supportedDurations)} sceneDuration=${sceneDuration} sceneCount=${sceneCount}`,
    );

    updateJob(jobId, { stage: "Planning scenes…" });
    let sceneDescriptions: string[];
    try {
      sceneDescriptions = await generateShotList(prompt, sceneCount);
      console.log(`[video] shot list: ${JSON.stringify(sceneDescriptions)}`);
    } catch (err) {
      console.error(
        "[video] shot list generation failed, falling back to one repeated description",
        err,
      );
      sceneDescriptions = Array(sceneCount).fill(prompt) as string[];
    }

    updateJob(jobId, { stage: `Generating scene 1/${sceneCount}…` });
    const scene1Submit = await videoProvider.submitScene({
      prompt: scenePrompt(sceneDescriptions[0], 0, sceneCount),
      model: videoModel.id,
      durationSeconds: sceneDuration,
    });
    const scene1Video = await waitForScene(videoProvider, scene1Submit.jobId);
    const scenePaths: string[] = [path.join(scratchDir, "scene-0.mp4")];
    await writeFile(scenePaths[0], scene1Video);

    const referenceFrame = await extractFrame(scenePaths[0], sceneDuration / 2);

    let completedScenes = 1;
    const remainingIndices = Array.from({ length: sceneCount - 1 }, (_, i) => i + 1);
    await Promise.all(
      remainingIndices.map(async (index) => {
        const submit = await videoProvider.submitScene({
          prompt: scenePrompt(sceneDescriptions[index], index, sceneCount),
          model: videoModel.id,
          durationSeconds: sceneDuration,
          referenceImage: referenceFrame,
        });
        const video = await waitForScene(videoProvider, submit.jobId);
        const scenePath = path.join(scratchDir, `scene-${index}.mp4`);
        await writeFile(scenePath, video);
        scenePaths[index] = scenePath;

        completedScenes += 1;
        updateJob(jobId, { stage: `Generating scene ${completedScenes}/${sceneCount}…` });
      }),
    );

    updateJob(jobId, { stage: "Stitching video…" });
    const finalPath = path.join(scratchDir, "final.mp4");
    await concatAndMux(scenePaths, audioPath, finalPath);

    updateJob(jobId, { stage: "Saving…" });
    const finalBuffer = await readFile(finalPath);
    const videoUrl = await saveVideo(finalBuffer, "mp4");

    updateJob(jobId, { status: "completed", stage: "Done", videoUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed";
    console.error(`[video] pipeline failed for job ${jobId}:`, err);
    updateJob(jobId, { status: "failed", error: message });
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
}
