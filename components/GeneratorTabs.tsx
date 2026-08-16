"use client";

import { useState } from "react";
import { GenerateMusicForm } from "@/components/GenerateMusicForm";
import { GenerateVideoForm } from "@/components/GenerateVideoForm";
import type { MusicModelOption } from "@/lib/music/models";

type Tab = "music" | "video";

export function GeneratorTabs({ models }: { models: MusicModelOption[] }) {
  const [tab, setTab] = useState<Tab>("music");

  return (
    <div>
      <div className="mb-6 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setTab("music")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "music"
              ? "bg-white text-neutral-900"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Music
        </button>
        <button
          type="button"
          onClick={() => setTab("video")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "video"
              ? "bg-white text-neutral-900"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Music Video
        </button>
      </div>

      {tab === "music" ? (
        <GenerateMusicForm models={models} />
      ) : (
        <GenerateVideoForm models={models} />
      )}
    </div>
  );
}
