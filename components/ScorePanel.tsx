"use client";

import { useState } from "react";
import { ChordDiagram } from "@/components/ChordDiagram";
import { SheetMusic } from "@/components/SheetMusic";
import { uniqueChords, type LeadSheet } from "@/lib/score/types";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "lead-sheet"
  );
}

function download(filename: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ScorePanel({
  prompt,
  tags,
}: {
  prompt: string;
  tags: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<LeadSheet | null>(null);

  async function generate() {
    if (prompt.trim().length < 3) {
      setError("Add a prompt first.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, tags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setSheet(data.leadSheet as LeadSheet);
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  function downloadAbc() {
    if (!sheet) return;
    download(
      `${slugify(sheet.title)}.abc`,
      `data:text/plain;charset=utf-8,${encodeURIComponent(sheet.abc)}`,
    );
  }

  async function downloadMidi() {
    if (!sheet) return;
    const abcjs = await import("abcjs");
    const encoded = abcjs.synth.getMidiFile(sheet.abc, {
      midiOutputType: "encoded",
    }) as string;
    download(`${slugify(sheet.title)}.mid`, encoded);
  }

  if (!sheet) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h3 className="text-sm font-semibold text-neutral-200">
          Chords &amp; sheet music
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Generate a lead sheet from your prompt and tags — key, tempo, a
          chord progression per section, guitar &amp; piano chord shapes, and
          printable notation.
        </p>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Composing lead sheet…" : "Generate chords & sheet music"}
        </button>
      </div>
    );
  }

  const chords = uniqueChords(sheet);

  return (
    <div className="space-y-5 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-100">
            {sheet.title}
          </h3>
          <p className="mt-1 text-xs text-neutral-400">
            {sheet.keyName} · {sheet.tempo} BPM · {sheet.timeSignature}
            {sheet.capo && sheet.capo > 0 ? ` · capo ${sheet.capo}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500"
          >
            Print
          </button>
          <button
            type="button"
            onClick={downloadAbc}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500"
          >
            .abc
          </button>
          <button
            type="button"
            onClick={downloadMidi}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500"
          >
            MIDI
          </button>
          <button
            type="button"
            onClick={() => setSheet(null)}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:border-neutral-500"
          >
            Regenerate
          </button>
        </div>
      </div>

      <div className="print-area space-y-5">
        <div className="hidden print:block">
          <h2 className="text-xl font-bold">{sheet.title}</h2>
          <p className="text-sm">
            {sheet.keyName} · {sheet.tempo} BPM · {sheet.timeSignature}
            {sheet.capo && sheet.capo > 0 ? ` · capo ${sheet.capo}` : ""}
          </p>
        </div>

        {/* Chord progression by section */}
        <div className="space-y-3">
          {sheet.sections.map((section, i) => (
            <div key={i}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 print:text-black">
                {section.name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {section.chords.map((chord, j) => (
                  <span
                    key={j}
                    className="min-w-[3rem] rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-center font-mono text-sm text-neutral-100 print:border-neutral-400 print:bg-white print:text-black"
                  >
                    {chord}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {sheet.performanceNotes && (
          <p className="text-xs italic text-neutral-400 print:text-black">
            {sheet.performanceNotes}
          </p>
        )}

        {/* Chord shapes */}
        {chords.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 print:text-black">
              Chord shapes
            </p>
            <div className="flex flex-wrap gap-2">
              {chords.map((chord) => (
                <ChordDiagram key={chord} symbol={chord} />
              ))}
            </div>
          </div>
        )}

        {/* Engraved notation */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 print:text-black">
            Sheet music
          </p>
          <SheetMusic abc={sheet.abc} />
        </div>
      </div>
    </div>
  );
}
