// Small, dependency-free chord toolkit: parse a chord symbol, spell it on a
// piano keyboard (exact), and derive a playable guitar shape (open-chord
// dictionary where one exists, otherwise a movable E-shape barre). This is a
// reference aid, not an engraver — uncommon symbols degrade to "root + name".

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const NAME_TO_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export interface ParsedChord {
  symbol: string;
  root: string; // normalized, e.g. "C#", "Bb"
  rootPc: number; // 0-11
  quality: ChordQuality;
  /** Bass note for slash chords, e.g. "G" in "C/G". */
  bass: string | null;
  bassPc: number | null;
  /** Semitone offsets from the root, root included (0). */
  intervals: number[];
}

export type ChordQuality =
  | "maj"
  | "min"
  | "dim"
  | "aug"
  | "7"
  | "maj7"
  | "min7"
  | "m7b5"
  | "dim7"
  | "6"
  | "min6"
  | "sus2"
  | "sus4"
  | "add9"
  | "9"
  | "maj9"
  | "min9";

const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  "6": [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 14],
  "9": [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  min9: [0, 3, 7, 10, 14],
};

function noteToPc(name: string): number | null {
  const m = /^([A-Ga-g])([#b]?)$/.exec(name.trim());
  if (!m) return null;
  const base = NAME_TO_PC[m[1].toUpperCase()];
  if (base === undefined) return null;
  const accidental = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return (base + accidental + 12) % 12;
}

function normalizeRoot(letter: string, accidental: string): string {
  return letter.toUpperCase() + (accidental === "b" ? "b" : accidental);
}

// Order matters: match longer suffixes first.
const QUALITY_SUFFIXES: Array<[string, ChordQuality]> = [
  ["maj9", "maj9"],
  ["maj7", "maj7"],
  ["m7b5", "m7b5"],
  ["min9", "min9"],
  ["m9", "min9"],
  ["min7", "min7"],
  ["m7", "min7"],
  ["min6", "min6"],
  ["m6", "min6"],
  ["dim7", "dim7"],
  ["dim", "dim"],
  ["add9", "add9"],
  ["sus2", "sus2"],
  ["sus4", "sus4"],
  ["sus", "sus4"],
  ["aug", "aug"],
  ["maj", "maj"],
  ["min", "min"],
  ["m", "min"],
  ["9", "9"],
  ["7", "7"],
  ["6", "6"],
  ["°", "dim"],
  ["+", "aug"],
];

export function parseChord(input: string): ParsedChord | null {
  const symbol = input.trim();
  const m = /^([A-Ga-g])([#b]?)(.*)$/.exec(symbol);
  if (!m) return null;

  const root = normalizeRoot(m[1], m[2]);
  const rootPc = noteToPc(root);
  if (rootPc === null) return null;

  let rest = m[3].trim();
  let bass: string | null = null;
  let bassPc: number | null = null;

  const slash = rest.split("/");
  if (slash.length === 2) {
    rest = slash[0].trim();
    const b = slash[1].trim();
    const bpc = noteToPc(b);
    if (bpc !== null) {
      bass = b.toUpperCase();
      bassPc = bpc;
    }
  }

  let quality: ChordQuality = "maj";
  for (const [suffix, q] of QUALITY_SUFFIXES) {
    if (rest === suffix) {
      quality = q;
      break;
    }
  }
  if (rest === "") quality = "maj";

  return {
    symbol,
    root,
    rootPc,
    quality,
    bass,
    bassPc,
    intervals: QUALITY_INTERVALS[quality],
  };
}

export interface PianoKey {
  pc: number;
  name: string;
  /** Semitones above the chord's lowest sounding note (bass or root). */
  offset: number;
  isBass: boolean;
  isRoot: boolean;
}

/** Pitch classes of the chord, laid out ascending from the bass note. */
export function pianoVoicing(chord: ParsedChord): PianoKey[] {
  const hasSlashBass =
    chord.bassPc !== null && chord.bassPc !== chord.rootPc;
  const lowPc = hasSlashBass ? (chord.bassPc as number) : chord.rootPc;
  const pcs = new Set<number>();

  const keys: PianoKey[] = [];
  const push = (pc: number, isBass: boolean) => {
    if (pcs.has(pc)) return;
    pcs.add(pc);
    keys.push({
      pc,
      name: NOTE_NAMES[pc],
      offset: (pc - lowPc + 12) % 12,
      isBass,
      isRoot: pc === chord.rootPc,
    });
  };

  if (hasSlashBass) push(chord.bassPc as number, true);
  for (const interval of chord.intervals) {
    push((chord.rootPc + interval) % 12, false);
  }

  return keys.sort((a, b) => a.offset - b.offset);
}

export interface GuitarShape {
  /** Six entries, low-E to high-E. -1 = muted, 0 = open, >0 = fret number. */
  frets: number[];
  /** Barre fret, or null. */
  barre: number | null;
  baseFret: number; // leftmost fret shown in the diagram (1 for open chords)
  label: string; // "open" | "E-shape barre" | "A-shape barre"
}

// Open / common shapes, low-E to high-E. -1 = mute.
const OPEN_SHAPES: Record<string, number[]> = {
  C: [-1, 3, 2, 0, 1, 0],
  Cmaj7: [-1, 3, 2, 0, 0, 0],
  C7: [-1, 3, 2, 3, 1, 0],
  D: [-1, -1, 0, 2, 3, 2],
  Dm: [-1, -1, 0, 2, 3, 1],
  D7: [-1, -1, 0, 2, 1, 2],
  Dmaj7: [-1, -1, 0, 2, 2, 2],
  Dm7: [-1, -1, 0, 2, 1, 1],
  E: [0, 2, 2, 1, 0, 0],
  Em: [0, 2, 2, 0, 0, 0],
  E7: [0, 2, 0, 1, 0, 0],
  Em7: [0, 2, 0, 0, 0, 0],
  Emaj7: [0, 2, 1, 1, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  Fmaj7: [-1, -1, 3, 2, 1, 0],
  G: [3, 2, 0, 0, 0, 3],
  G7: [3, 2, 0, 0, 0, 1],
  Gmaj7: [3, 2, 0, 0, 0, 2],
  A: [-1, 0, 2, 2, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  A7: [-1, 0, 2, 0, 2, 0],
  Am7: [-1, 0, 2, 0, 1, 0],
  Amaj7: [-1, 0, 2, 1, 2, 0],
  B7: [-1, 2, 1, 2, 0, 2],
  Bm: [-1, 2, 4, 4, 3, 2],
};

// Movable barre templates relative to the barre fret, low-E to high-E.
// Root is on the low-E string.
const E_SHAPE_TEMPLATES: Partial<Record<ChordQuality, number[]>> = {
  maj: [0, 2, 2, 1, 0, 0],
  min: [0, 2, 2, 0, 0, 0],
  "7": [0, 2, 0, 1, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  min7: [0, 2, 0, 0, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
  sus2: [0, 2, 4, 4, 0, 0],
  "6": [0, 2, 2, 1, 2, 0],
  min6: [0, 2, 2, 0, 2, 0],
  dim: [0, 1, 2, 0, -1, -1],
  aug: [0, 3, 2, 1, 1, 0],
  "9": [0, 2, 0, 1, 0, 2],
  add9: [0, 2, 2, 1, 0, 2],
  m7b5: [0, 1, 0, 0, -1, -1],
  dim7: [0, 1, 2, 0, 2, -1],
  maj9: [0, 2, 1, 1, 0, 2],
  min9: [0, 2, 0, 0, 0, 2],
};

export function guitarShape(chord: ParsedChord): GuitarShape | null {
  // Exact dictionary hit (normalize a couple of common spellings).
  const dictKey =
    chord.quality === "maj"
      ? chord.root
      : `${chord.root}${dictSuffix(chord.quality)}`;
  const open = OPEN_SHAPES[dictKey];
  if (open && !chord.bass) {
    const played = open.filter((f) => f > 0);
    return {
      frets: open,
      barre: null,
      baseFret: played.length ? Math.min(1, ...played) : 1,
      label: "open",
    };
  }

  const template = E_SHAPE_TEMPLATES[chord.quality];
  if (!template) return null;

  // Low-E open string is pitch class 4 (E). Fret on the low-E that sounds the
  // root — 0 means the shape sits in open position (no barre needed).
  const barreFret = (chord.rootPc - 4 + 12) % 12;

  const frets = template.map((rel) => (rel < 0 ? -1 : rel + barreFret));
  const played = frets.filter((f) => f > 0);
  const minFret = played.length ? Math.min(...played) : 1;
  const maxFret = played.length ? Math.max(...played) : 1;
  const baseFret = maxFret <= 4 ? 1 : minFret;

  return {
    frets,
    barre: barreFret > 0 ? barreFret : null,
    baseFret,
    label: barreFret > 0 ? "E-shape barre" : "open",
  };
}

function dictSuffix(quality: ChordQuality): string {
  switch (quality) {
    case "min":
      return "m";
    case "maj7":
      return "maj7";
    case "min7":
      return "m7";
    case "7":
      return "7";
    default:
      return "";
  }
}

export { NOTE_NAMES };
