import { MUSIC_MODELS } from "@/lib/music/models";
import { GenerateMusicForm } from "@/components/GenerateMusicForm";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Generate music</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Describe what you want and pick a model.
        </p>
      </div>
      <GenerateMusicForm models={MUSIC_MODELS} />
    </div>
  );
}
