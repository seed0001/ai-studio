export interface MusicModelOption {
  id: string; // OpenRouter model slug
  name: string;
  description: string;
}

export const MUSIC_MODELS: MusicModelOption[] = [
  {
    id: "google/lyria-3-clip-preview",
    name: "Lyria 3 — Clip",
    description: "30-second instrumental clip or loop.",
  },
  {
    id: "google/lyria-3-pro-preview",
    name: "Lyria 3 — Full song",
    description: "Full-length song with vocals, verses, chorus, and bridge.",
  },
];

export function getMusicModel(id: string): MusicModelOption | undefined {
  return MUSIC_MODELS.find((model) => model.id === id);
}
