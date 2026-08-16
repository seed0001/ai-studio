export interface MusicModelOption {
  id: string; // OpenRouter model slug
  name: string;
  description: string;
  durationSeconds: number;
  creditsCost: number;
}

export const MUSIC_MODELS: MusicModelOption[] = [
  {
    id: "google/lyria-3-clip-preview",
    name: "Lyria 3 — Clip",
    description: "30-second instrumental clip or loop.",
    durationSeconds: 30,
    creditsCost: 5,
  },
  {
    id: "google/lyria-3-pro-preview",
    name: "Lyria 3 — Full song",
    description: "Full-length song with vocals, verses, chorus, and bridge.",
    durationSeconds: 150,
    creditsCost: 10,
  },
];

export function getMusicModel(id: string): MusicModelOption | undefined {
  return MUSIC_MODELS.find((model) => model.id === id);
}
