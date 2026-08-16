export interface MusicGenerationParams {
  prompt: string;
  model: string; // OpenRouter model slug
}

export interface MusicGenerationResult {
  audio: Buffer;
  format: string;
}

export interface MusicProvider {
  generate(params: MusicGenerationParams): Promise<MusicGenerationResult>;
}
