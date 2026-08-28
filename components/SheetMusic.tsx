"use client";

import { useEffect, useRef, useState } from "react";
import "abcjs/abcjs-audio.css";

// abcjs touches `window` on import, so it must only load in the browser.
type Abcjs = typeof import("abcjs");

export function SheetMusic({ abc }: { abc: string }) {
  const paperRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLDivElement>(null);
  const abcjsRef = useRef<Abcjs | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const abcjs = abcjsRef.current ?? (await import("abcjs"));
        abcjsRef.current = abcjs;
        if (cancelled || !paperRef.current) return;

        const visualObj = abcjs.renderAbc(paperRef.current, abc, {
          responsive: "resize",
          add_classes: true,
          paddingtop: 8,
          paddingbottom: 8,
        });
        setRenderError(null);

        // Optional playback — only if the browser supports Web Audio.
        if (
          abcjs.synth.supportsAudio() &&
          audioRef.current &&
          visualObj[0]
        ) {
          const synthControl = new abcjs.synth.SynthController();
          synthControl.load(audioRef.current, null, {
            displayPlay: true,
            displayProgress: true,
            displayRestart: true,
          });
          await synthControl.setTune(visualObj[0], false);
          if (!cancelled) setAudioReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setRenderError(
            err instanceof Error ? err.message : "Could not render the score",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [abc]);

  return (
    <div className="space-y-3">
      <div
        ref={paperRef}
        className="score-paper overflow-x-auto rounded-lg bg-white p-3 text-black"
      />
      {renderError && (
        <p className="text-xs text-amber-500">
          Notation preview failed: {renderError}. The chord chart above still
          applies.
        </p>
      )}
      <div
        ref={audioRef}
        className={audioReady ? "abcjs-audio-controls" : "hidden"}
      />
    </div>
  );
}
