import Link from "next/link";
import { CREDIT_PACKS } from "@/lib/credit-packs";

const MEDIA_TYPES = [
  {
    name: "Music",
    status: "Available now",
    description:
      "Generate full songs with vocals or short instrumental clips from a text prompt.",
    available: true,
  },
  {
    name: "Video",
    status: "Coming soon",
    description: "Turn a script or prompt into a finished video clip.",
    available: false,
  },
  {
    name: "Audiobooks",
    status: "Coming soon",
    description: "Narrate long-form text into a polished audiobook.",
    available: false,
  },
  {
    name: "Podcasts",
    status: "Coming soon",
    description: "Produce multi-voice podcast episodes from an outline.",
    available: false,
  },
  {
    name: "Episodes",
    status: "Coming soon",
    description: "Full episodic content combining voice, music, and video.",
    available: false,
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">AI Studio</span>
        <nav className="flex items-center gap-6 text-sm text-neutral-400">
          <a href="#features" className="hover:text-white">
            Features
          </a>
          <a href="#pricing" className="hover:text-white">
            Pricing
          </a>
          <Link
            href="/sign-in"
            className="rounded-lg bg-white px-4 py-2 font-medium text-neutral-900 transition hover:bg-neutral-200"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-center sm:pt-24">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            One studio. Every format.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
            Generate music, video, audiobooks, podcasts, and full episodes with
            AI &mdash; powered by best-in-class models, paid for with simple
            credits.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/sign-in"
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Start creating
            </Link>
            <a
              href="#pricing"
              className="rounded-lg border border-neutral-700 px-6 py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
            >
              View pricing
            </a>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Built for every kind of content
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MEDIA_TYPES.map((media) => (
              <div
                key={media.name}
                className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-white">{media.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      media.available
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {media.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-neutral-400">
                  {media.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-6 pb-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Buy credits, use them anywhere in the studio
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-neutral-400">
            No subscriptions. Credit packs never expire and work across every
            generator in the studio.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/50 p-6"
              >
                <h3 className="font-medium text-white">{pack.name}</h3>
                <p className="mt-2 text-3xl font-semibold text-white">
                  ${pack.priceUsd}
                </p>
                <p className="mt-1 text-sm text-neutral-400">
                  {pack.credits} credits
                </p>
                <Link
                  href="/sign-in"
                  className="mt-6 rounded-lg border border-neutral-700 px-4 py-2 text-center text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-900 py-8 text-center text-sm text-neutral-500">
        © {new Date().getFullYear()} AI Studio.
      </footer>
    </div>
  );
}
