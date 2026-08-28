import {
  guitarShape,
  parseChord,
  pianoVoicing,
  type ParsedChord,
} from "@/lib/music/chords";

const SEMI_IS_BLACK = [
  false,
  true,
  false,
  true,
  false,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
];
// White-key ordinal for each semitone within an octave.
const SEMI_WHITE_INDEX = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

function GuitarChart({ chord }: { chord: ParsedChord }) {
  const shape = guitarShape(chord);
  if (!shape) return null;

  const strings = 6;
  const rows = 5;
  const left = 16;
  const top = 22;
  const cell = 13;
  const w = left + (strings - 1) * cell + 16;
  const h = top + rows * cell + 14;
  const baseFret = shape.baseFret;

  const x = (s: number) => left + s * cell;
  const y = (f: number) => top + f * cell;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[104px] w-auto"
      role="img"
      aria-label={`${chord.symbol} guitar chord diagram`}
    >
      {/* Fretboard grid */}
      {Array.from({ length: strings }, (_, s) => (
        <line
          key={`s${s}`}
          x1={x(s)}
          y1={top}
          x2={x(s)}
          y2={y(rows)}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.5}
        />
      ))}
      {Array.from({ length: rows + 1 }, (_, f) => (
        <line
          key={`f${f}`}
          x1={x(0)}
          y1={y(f)}
          x2={x(strings - 1)}
          y2={y(f)}
          stroke="currentColor"
          strokeWidth={f === 0 && baseFret === 1 ? 3 : 1}
          opacity={0.5}
        />
      ))}

      {baseFret > 1 && (
        <text
          x={x(0) - 6}
          y={y(0) + cell * 0.7}
          textAnchor="end"
          fontSize={9}
          fill="currentColor"
          opacity={0.7}
        >
          {baseFret}fr
        </text>
      )}

      {/* Barre */}
      {shape.barre !== null && shape.barre - baseFret + 1 >= 1 && (
        <rect
          x={x(0) - 3}
          y={y(shape.barre - baseFret) + cell * 0.2}
          width={x(strings - 1) - x(0) + 6}
          height={cell * 0.6}
          rx={cell * 0.3}
          fill="currentColor"
          opacity={0.85}
        />
      )}

      {/* Per-string markers */}
      {shape.frets.map((fret, i) => {
        const s = i; // low-E on the left
        if (fret === -1) {
          return (
            <text
              key={`x${i}`}
              x={x(s)}
              y={top - 8}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
              opacity={0.6}
            >
              ×
            </text>
          );
        }
        if (fret === 0) {
          return (
            <circle
              key={`o${i}`}
              cx={x(s)}
              cy={top - 11}
              r={3.2}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
              opacity={0.7}
            />
          );
        }
        const rel = fret - baseFret;
        if (rel < 0 || rel >= rows) return null;
        return (
          <circle
            key={`d${i}`}
            cx={x(s)}
            cy={y(rel) + cell / 2}
            r={cell * 0.38}
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}

function PianoChart({ chord }: { chord: ParsedChord }) {
  const voicing = pianoVoicing(chord);
  const span = Math.max(12, ...voicing.map((k) => k.offset)) + 1;
  const octaves = span > 12 ? 2 : 1;
  const totalWhites = octaves === 2 ? 15 : 8;

  const whiteW = 11;
  const whiteH = 46;
  const blackW = 7;
  const blackH = 28;
  const w = totalWhites * whiteW + 1;
  const h = whiteH + 14;

  const lit = new Map(voicing.map((k) => [k.offset, k]));

  // White-key x for an absolute semitone offset.
  const whiteX = (semi: number) => {
    const octave = Math.floor(semi / 12);
    const within = semi % 12;
    return (octave * 7 + SEMI_WHITE_INDEX[within]) * whiteW;
  };

  const whiteKeys: React.ReactElement[] = [];
  const blackKeys: React.ReactElement[] = [];

  for (let semi = 0; semi < octaves * 12; semi++) {
    const on = lit.get(semi);
    if (SEMI_IS_BLACK[semi % 12]) {
      const bx = whiteX(semi) + whiteW - blackW / 2;
      blackKeys.push(
        <rect
          key={`b${semi}`}
          x={bx}
          y={0}
          width={blackW}
          height={blackH}
          rx={1.5}
          fill={on ? "var(--chord-accent, #4f46e5)" : "#111"}
          stroke="currentColor"
          strokeWidth={0.5}
        />,
      );
    } else {
      const wx = whiteX(semi);
      whiteKeys.push(
        <rect
          key={`w${semi}`}
          x={wx}
          y={0}
          width={whiteW}
          height={whiteH}
          fill={
            on
              ? on.isBass
                ? "var(--chord-bass, #a5b4fc)"
                : "var(--chord-accent, #4f46e5)"
              : "transparent"
          }
          stroke="currentColor"
          strokeWidth={0.75}
          opacity={on ? 1 : 0.6}
        />,
      );
    }
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[60px] w-auto"
      role="img"
      aria-label={`${chord.symbol} piano voicing`}
    >
      {whiteKeys}
      {blackKeys}
      {voicing.map((k) => (
        <text
          key={`lbl${k.offset}`}
          x={whiteX(k.offset) + (SEMI_IS_BLACK[k.offset % 12] ? whiteW : whiteW / 2)}
          y={h - 3}
          textAnchor="middle"
          fontSize={7}
          fill="currentColor"
          opacity={0.75}
        >
          {k.name}
        </text>
      ))}
    </svg>
  );
}

export function ChordDiagram({ symbol }: { symbol: string }) {
  const chord = parseChord(symbol);

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-neutral-200 print:border-neutral-400">
      <div className="font-mono text-sm font-semibold">{symbol}</div>
      {chord ? (
        <>
          <GuitarChart chord={chord} />
          {chord.bass && chord.bass !== chord.root && (
            <div className="text-[10px] text-neutral-500">
              bass note {chord.bass}
            </div>
          )}
          <PianoChart chord={chord} />
        </>
      ) : (
        <div className="py-4 text-center text-xs text-neutral-500">
          no diagram
        </div>
      )}
    </div>
  );
}
