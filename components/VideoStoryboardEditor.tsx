"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoJob, Scene } from "@/lib/video-jobs";

const POLL_INTERVAL_MS = 3000;

export function VideoStoryboardEditor({
  jobId,
  onStartOver,
}: {
  jobId: string;
  onStartOver: () => void;
}) {
  const [job, setJob] = useState<VideoJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function poll() {
    const res = await fetch(`/api/generate/video-song/${jobId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setJob(data.job);
  }

  useEffect(() => {
    // Fetch-on-mount for a job status poll; the state update happens after
    // the await, not synchronously during this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function editScene(index: number, description: string) {
    await fetch(`/api/generate/video-song/${jobId}/scenes/${index}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    poll();
  }

  async function regenerateScene(index: number) {
    await fetch(`/api/generate/video-song/${jobId}/scenes/${index}/regenerate`, {
      method: "POST",
    });
    poll();
  }

  async function approveTake(index: number, takeIndex: number) {
    await fetch(`/api/generate/video-song/${jobId}/scenes/${index}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ takeIndex }),
    });
    poll();
  }

  async function generateAll() {
    await fetch(`/api/generate/video-song/${jobId}/generate`, { method: "POST" });
    poll();
  }

  async function stitch() {
    setError(null);
    const res = await fetch(`/api/generate/video-song/${jobId}/stitch`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Stitching failed");
      return;
    }
    setJob(data.job);
  }

  if (!job) {
    return <p className="text-sm text-neutral-400">Loading…</p>;
  }

  if (job.status === "planning") {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
        <p className="text-sm text-neutral-300">{job.stage}</p>
        <p className="mt-2 text-xs text-neutral-500">
          Generating the song and planning scenes…
        </p>
      </div>
    );
  }

  if (job.status === "failed" && job.scenes.length === 0) {
    return (
      <div className="rounded-xl border border-red-900 bg-red-950/30 p-6">
        <p className="text-sm text-red-400">{job.error}</p>
        <button
          onClick={onStartOver}
          className="mt-4 text-sm text-neutral-400 underline"
        >
          Start over
        </button>
      </div>
    );
  }

  const hasAnyTakes = job.scenes.some((scene) => scene.takes.length > 0);
  const allApproved = job.scenes.every((scene) => scene.approvedTakeIndex !== null);
  const anyGenerating =
    job.scenes.some((scene) => scene.status === "generating") || job.status === "stitching";
  const anchorReady = job.scenes[0]?.approvedTakeIndex !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onStartOver}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          ← Start over
        </button>
        {job.songUrl && <audio controls src={job.songUrl} className="h-8" />}
      </div>

      {!hasAnyTakes && (
        <button
          onClick={generateAll}
          disabled={anyGenerating}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {anyGenerating
            ? "Generating scenes…"
            : `Generate all ${job.scenes.length} scenes`}
        </button>
      )}

      <div className="space-y-4">
        {job.scenes.map((scene) => (
          <SceneCard
            key={scene.index}
            scene={scene}
            canGenerate={scene.index === 0 || anchorReady}
            onEdit={(description) => editScene(scene.index, description)}
            onRegenerate={() => regenerateScene(scene.index)}
            onApprove={(takeIndex) => approveTake(scene.index, takeIndex)}
          />
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {hasAnyTakes && (
        <button
          onClick={stitch}
          disabled={!allApproved || anyGenerating}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {allApproved ? "Stitch final video" : "Waiting on all scenes…"}
        </button>
      )}

      {job.finalVideoUrl && (
        <div className="pt-2">
          <p className="mb-2 text-sm font-medium text-neutral-300">Final video</p>
          <video controls src={job.finalVideoUrl} className="w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

function SceneCard({
  scene,
  canGenerate,
  onEdit,
  onRegenerate,
  onApprove,
}: {
  scene: Scene;
  canGenerate: boolean;
  onEdit: (description: string) => void;
  onRegenerate: () => void;
  onApprove: (takeIndex: number) => void;
}) {
  const [text, setText] = useState(scene.description);
  const dirty = text !== scene.description;
  const approvedTake =
    scene.approvedTakeIndex !== null ? scene.takes[scene.approvedTakeIndex] : undefined;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400">
          Scene {scene.index + 1}
        </span>
        <span className="text-xs text-neutral-500">
          {scene.status === "generating"
            ? "Generating…"
            : scene.status === "failed"
              ? "Failed"
              : `${scene.takes.length} take${scene.takes.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
      />
      {dirty && (
        <button
          onClick={() => onEdit(text)}
          className="mt-1 text-xs text-indigo-400 hover:text-indigo-300"
        >
          Save description
        </button>
      )}

      {scene.error && <p className="mt-2 text-xs text-red-400">{scene.error}</p>}

      {approvedTake && (
        <video controls src={approvedTake.videoUrl} className="mt-3 w-full rounded-lg" />
      )}

      {scene.takes.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {scene.takes.map((take) => (
            <button
              key={take.index}
              onClick={() => onApprove(take.index)}
              className={`rounded px-2 py-1 text-xs ${
                take.index === scene.approvedTakeIndex
                  ? "bg-indigo-600 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              Take {take.index + 1}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onRegenerate}
        disabled={scene.status === "generating" || !canGenerate}
        title={!canGenerate ? "Generate scene 1 first" : undefined}
        className="mt-3 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {scene.status === "generating"
          ? "Generating…"
          : scene.takes.length === 0
            ? "Generate"
            : "Regenerate"}
      </button>
    </div>
  );
}
