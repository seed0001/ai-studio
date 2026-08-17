"use client";

import { useState } from "react";
import type { MusicModelOption } from "@/lib/music/models";
import { VideoStoryboardEditor } from "@/components/VideoStoryboardEditor";

export function GenerateVideoForm({ models }: { models: MusicModelOption[] }) {
  const [mode, setMode] = useState<"generate" | "upload">("generate");
  const [prompt, setPrompt] = useState("");
  const [musicModelId, setMusicModelId] = useState(models[0]?.id ?? "");
  const [songFile, setSongFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let res: Response;
    if (mode === "upload") {
      if (!songFile) {
        setError("Choose a song file to upload");
        setSubmitting(false);
        return;
      }
      const form = new FormData();
      form.set("prompt", prompt);
      form.set("audio", songFile);
      res = await fetch("/api/generate/video-song/upload", {
        method: "POST",
        body: form,
      });
    } else {
      res = await fetch("/api/generate/video-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, musicModelId }),
      });
    }

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
      <div className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-950 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("generate")}
          className={`flex-1 rounded-md px-3 py-1.5 transition ${
            mode === "generate"
              ? "bg-neutral-800 text-white"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Generate song
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex-1 rounded-md px-3 py-1.5 transition ${
            mode === "upload"
              ? "bg-neutral-800 text-white"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Upload song
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-300">
          Prompt
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          {mode === "upload"
            ? "Describe the character/visual style for the video — the shots are planned around this, not the audio."
            : "Describe the song and the character/visual style. Once the song and scene plan are ready, you can edit and regenerate individual scenes before the final video is stitched together."}
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

      {mode === "upload" ? (
        <div>
          <label className="block text-sm font-medium text-neutral-300">
            Song file
          </label>
          <input
            type="file"
            accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/flac,.mp3,.wav,.m4a,.ogg,.flac"
            onChange={(e) => setSongFile(e.target.files?.[0] ?? null)}
            required
            className="mt-2 w-full text-sm text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-neutral-700"
          />
          <p className="mt-2 text-xs text-neutral-500">
            mp3, wav, m4a, ogg, or flac — 50MB max.
          </p>
        </div>
      ) : (
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
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting || (mode === "generate" && !musicModelId)}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Starting…"
          : mode === "upload"
            ? "Start music video from uploaded song"
            : "Start music video"}
      </button>
    </form>
  );
}
