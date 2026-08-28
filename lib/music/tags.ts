export interface TagCategory {
  /** Stable key, also used as the label prefix when composing the prompt. */
  key: string;
  label: string;
  /** Whether more than one tag in this category can be selected at once. */
  multi: boolean;
  tags: string[];
}

// Curated palette of style tags. These are appended to the free-text prompt
// (see composePromptWithTags) so the music model — and the lead-sheet model —
// both see a consistent, structured description of the intended style.
export const TAG_CATEGORIES: TagCategory[] = [
  {
    key: "genre",
    label: "Genre",
    multi: true,
    tags: [
      "pop",
      "rock",
      "indie",
      "hip-hop",
      "R&B",
      "soul",
      "funk",
      "electronic",
      "house",
      "synthwave",
      "lo-fi",
      "ambient",
      "jazz",
      "blues",
      "folk",
      "country",
      "classical",
      "orchestral",
      "metal",
      "punk",
      "reggae",
      "latin",
      "gospel",
      "afrobeat",
    ],
  },
  {
    key: "mood",
    label: "Mood",
    multi: true,
    tags: [
      "uplifting",
      "melancholic",
      "energetic",
      "chill",
      "dark",
      "dreamy",
      "aggressive",
      "romantic",
      "nostalgic",
      "epic",
      "playful",
      "tense",
      "peaceful",
      "triumphant",
    ],
  },
  {
    key: "vocals",
    label: "Vocals",
    multi: false,
    tags: [
      "female vocals",
      "male vocals",
      "duet",
      "choir",
      "rap verses",
      "spoken word",
      "instrumental (no vocals)",
    ],
  },
  {
    key: "instruments",
    label: "Instruments",
    multi: true,
    tags: [
      "acoustic guitar",
      "electric guitar",
      "fingerpicked guitar",
      "piano",
      "electric piano",
      "organ",
      "synth pads",
      "arpeggiated synth",
      "808 bass",
      "upright bass",
      "live drums",
      "lo-fi drums",
      "strings",
      "brass",
      "saxophone",
      "orchestral percussion",
    ],
  },
  {
    key: "tempo",
    label: "Tempo",
    multi: false,
    tags: [
      "ballad (~65 BPM)",
      "downtempo (~90 BPM)",
      "mid-tempo (~110 BPM)",
      "upbeat (~128 BPM)",
      "dance (~140 BPM)",
    ],
  },
  {
    key: "era",
    label: "Era",
    multi: false,
    tags: ["1960s", "1970s", "1980s", "1990s", "2000s", "modern"],
  },
];

const TAG_TO_CATEGORY = new Map<string, TagCategory>();
for (const category of TAG_CATEGORIES) {
  for (const tag of category.tags) {
    TAG_TO_CATEGORY.set(tag, category);
  }
}

/** Drop unknown tags and de-duplicate, preserving catalog order. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set(tags);
  const out: string[] = [];
  for (const category of TAG_CATEGORIES) {
    for (const tag of category.tags) {
      if (seen.has(tag)) out.push(tag);
    }
  }
  return out;
}

/**
 * Fold the selected style tags into the prompt as a single trailing line,
 * grouped by category. Returns the prompt unchanged when nothing is selected.
 */
export function composePromptWithTags(prompt: string, tags: string[]): string {
  const normalized = normalizeTags(tags);
  if (normalized.length === 0) return prompt.trim();

  const grouped = new Map<string, string[]>();
  for (const tag of normalized) {
    const category = TAG_TO_CATEGORY.get(tag);
    if (!category) continue;
    const list = grouped.get(category.label) ?? [];
    list.push(tag);
    grouped.set(category.label, list);
  }

  const parts = [...grouped.entries()].map(
    ([label, list]) => `${label.toLowerCase()}: ${list.join(", ")}`,
  );

  const base = prompt.trim();
  const styleLine = `Style — ${parts.join("; ")}.`;
  return base ? `${base}\n\n${styleLine}` : styleLine;
}
