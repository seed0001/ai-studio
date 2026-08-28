"use client";

import { useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ScorePanel } from "@/components/ScorePanel";
import { TagPicker } from "@/components/TagPicker";
import type { MusicModelOption } from "@/lib/music/models";

export function GenerateMusicForm({ models }: { models: MusicModelOption[] }) {
  const [prompt, setPrompt] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const selectedModel = models.find((model) => model.id === modelId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAudioUrl(null);

    const res = await fetch("/api/generate/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, modelId, tags }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    setAudioUrl(data.audioUrl);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6"
      >
        <div>
          <label className="block text-sm font-medium text-neutral-300">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            minLength={3}
            rows={4}
            placeholder="An upbeat synthwave track with driving bass and dreamy pads"
            className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
        </div>

        <TagPicker value={tags} onChange={setTags} />

        <div>
          <label className="block text-sm font-medium text-neutral-300">
            Model
          </label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm text-white focus:border-neutral-500 focus:outline-none"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          {selectedModel && (
            <p className="mt-2 text-xs text-neutral-500">
              {selectedModel.description}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || !modelId}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate"}
        </button>

        {audioUrl && (
          <div className="pt-2">
            <AudioPlayer src={audioUrl} />
          </div>
        )}
      </form>

      <ScorePanel prompt={prompt} tags={tags} />
    </div>
  );
}
