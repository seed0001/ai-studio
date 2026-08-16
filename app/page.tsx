import { MUSIC_MODELS } from "@/lib/music/models";
import { GenerateMusicForm } from "@/components/GenerateMusicForm";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">AI Studio</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Describe a song, pick a model, generate.
        </p>
      </div>
      <GenerateMusicForm models={MUSIC_MODELS} />
    </div>
  );
}
