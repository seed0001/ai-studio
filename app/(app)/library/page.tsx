import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AudioPlayer } from "@/components/AudioPlayer";
import { getMusicModel } from "@/lib/music/models";

export default async function LibraryPage() {
  const session = await auth();
  const generations = await db.generation.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Library</h1>

      {generations.length === 0 && (
        <p className="text-sm text-neutral-400">Nothing generated yet.</p>
      )}

      <div className="space-y-4">
        {generations.map((gen) => (
          <div
            key={gen.id}
            className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-neutral-300">{gen.prompt}</p>
              <span className="shrink-0 text-xs text-neutral-500">
                {getMusicModel(gen.model)?.name ?? gen.model} ·{" "}
                {gen.creditsCost} credits
              </span>
            </div>
            <div className="mt-3">
              {gen.status === "COMPLETED" && gen.audioUrl && (
                <AudioPlayer src={gen.audioUrl} />
              )}
              {gen.status === "PENDING" && (
                <p className="text-sm text-neutral-500">Generating…</p>
              )}
              {gen.status === "FAILED" && (
                <p className="text-sm text-red-400">
                  Failed: {gen.errorMessage}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
