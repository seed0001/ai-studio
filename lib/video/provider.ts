export interface VideoSceneParams {
  prompt: string;
  model: string;
  durationSeconds: number;
  /** JPEG bytes of a reference frame, used to anchor character/style consistency. */
  referenceImage?: Buffer;
}

export type VideoJobStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface VideoPollResult {
  status: VideoJobStatus;
  video?: Buffer;
  error?: string;
}

export interface VideoProvider {
  /** Discrete durations (seconds) this model accepts — query before submitting. */
  getSupportedDurations(model: string): Promise<number[]>;
  submitScene(params: VideoSceneParams): Promise<{ jobId: string }>;
  /** Call repeatedly until status is terminal. `video` is populated once "completed". */
  pollScene(jobId: string): Promise<VideoPollResult>;
}
