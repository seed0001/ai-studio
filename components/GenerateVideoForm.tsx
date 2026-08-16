"use client";

import { useState } from "react";
import type { MusicModelOption } from "@/lib/music/models";
import { VideoStoryboardEditor } from "@/components/VideoStoryboardEditor";

export function GenerateVideoForm({ models }: { models: MusicModelOption[] }) {
  const [prompt, setPrompt] = useState("");
  const [musicModelId, setMusicModelId] = useState(models[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/generate/video-song", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, musicModelId }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    setJobId(data.jobId);
  }

  if (jobId) {
    return (
      <VideoStoryboardEditor jobId={jobId} onStartOver={() => setJobId(null)} />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6"
    >
      <div>
        <label className="block text-sm font-medium text-neutral-300">
          Prompt
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          Describe the song and the character/visual style. Once the song and
          scene plan are ready, you can edit and regenerate individual scenes
          before the final video is stitched together.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          minLength={3}
          rows={6}
          placeholder="A moody synth-pop song about... A lone astronaut in a weathered orange spacesuit, cinematic lighting, 35mm film grain..."
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-300">
          Song length
        </label>
        <select
          value={musicModelId}
          onChange={(e) => setMusicModelId(e.target.value)}
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm text-white focus:border-neutral-500 focus:outline-none"
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-neutral-500">
          Longer songs mean more video scenes — more cost and generation
          time. Try the clip length first.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !musicModelId}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Starting…" : "Start music video"}
      </button>
    </form>
  );
}
