export interface VideoModelOption {
  id: string; // OpenRouter model slug
  name: string;
  pricePerSecond: number;
}

export const VIDEO_MODELS: VideoModelOption[] = [
  {
    id: "google/veo-3.1-lite",
    name: "Veo 3.1 Lite",
    pricePerSecond: 0.05,
  },
  {
    id: "bytedance/seedance-2.0-mini",
    name: "Seedance 2.0 Mini",
    pricePerSecond: 0.01345,
  },
];

export const DEFAULT_VIDEO_MODEL = VIDEO_MODELS[0];

export function getVideoModel(id: string): VideoModelOption | undefined {
  return VIDEO_MODELS.find((model) => model.id === id);
}
