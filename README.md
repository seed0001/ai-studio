# AI Studio

A simple, stateless generator: songs, and music videos built around them. No
accounts, no database, no billing — just generation. (Audiobooks, podcasts,
and full episodes are the eventual direction; this is the first two slices.)

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind)
- Local disk storage (`data/songs/`, `data/videos/`) — on Railway this is a
  mounted volume so files survive redeploys; only the most recent files are
  kept (3 songs, 2 videos — see `lib/storage.ts`)
- `ffmpeg-static` / `ffprobe-static` — video concatenation, audio muxing,
  duration probing, reference-frame extraction (see `lib/ffmpeg.ts`)
- OpenRouter — audio: `google/lyria-3-pro-preview` / `google/lyria-3-clip-preview`;
  video: `bytedance/seedance-2.0-mini`

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Copy the env file and fill it in**

   ```bash
   cp .env.example .env
   ```

   You'll need an OpenRouter API key (`OPENROUTER_API_KEY`).

3. **Run the dev server**

   ```bash
   npm run dev
   ```

## Notes

### Music

- Selectable music models live in `lib/music/models.ts` — add an entry there
  to expose another OpenRouter model in the dropdown.
- Music generation is wrapped behind `MusicProvider` (`lib/music/provider.ts`)
  so the OpenRouter integration (`lib/music/openrouter.ts`) can be swapped or
  adjusted in one place. OpenRouter's Lyria 3 audio-output support is a newer,
  thinly-documented feature — the audio comes back streamed (`stream: true`,
  reassembled from SSE deltas in `openrouter.ts`), since non-streaming
  requests are rejected. Re-verify the delta shape if this starts failing.

### Music video

- One prompt drives both the song and every video scene — describe the song
  *and* the character/visual style together, since there's no separate field
  for each.
- Pipeline (`lib/video-song-pipeline.ts`): generate the song → probe its real
  duration (Lyria doesn't report one) via `ffprobe` → split into ~10s scenes
  → generate scene 1 from the prompt alone → extract a reference frame from
  it → generate the remaining scenes in parallel, each anchored to that frame
  via OpenRouter's `input_references[]` for character/style consistency →
  concat all scenes and mux in the song audio via `ffmpeg` → save.
- This is genuinely unverified against a live API call as of this writing —
  same situation the audio integration was in before its first real test.
  Specifically unconfirmed: whether `input_references[].image_url.url`
  accepts a base64 data URI (what `lib/video/openrouter.ts` currently sends)
  or requires a hosted URL, and the exact `supported_durations` Seedance 2.0
  Mini returns from `/api/v1/videos/models` (queried at runtime rather than
  hardcoded, specifically to avoid guessing wrong). **Test with the Clip
  song length first** — fewer, cheaper scenes — before trying a full song.
- Cost adds up fast relative to audio-only generation: video runs roughly
  $0.0135/scene-second on the default model, so a ~150s full song (≈15
  scenes at 10s each) costs a few dollars in video generation alone, on top
  of the song itself. The clip length (~30s, ~3 scenes) is far cheaper for
  testing.
- Job state (`lib/video-jobs.ts`) is an **in-memory** map, not a database —
  the frontend polls `GET /api/generate/video-song/[jobId]` every 3s while a
  job runs. A job in progress is lost if the container restarts or redeploys
  mid-run. The whole pipeline runs as a fire-and-forget background task
  after the initial POST responds (`void runVideoSongPipeline(...)` in
  `app/api/generate/video-song/route.ts`) — this relies on Railway's
  always-on container keeping the process alive; it would not work as-is on
  a serverless host.

### Storage

- `lib/storage.ts` writes generated files to `data/songs/` and
  `data/videos/`, served through `app/songs/[filename]/route.ts` and
  `app/videos/[filename]/route.ts` — deliberately not under `public/`, since
  Next's static file serving for `public/` appears to work off a build-time
  snapshot and won't pick up files written there at runtime (confirmed: a
  file existed on disk but still 404'd). Locally these are just normal
  (gitignored) folders; in production they're covered by a single Railway
  volume mounted at `/app/data` on the `web` service, so files persist
  across deploys instead of vanishing when the container restarts.
- There's still no database: nothing is recorded outside the handful of
  files currently on disk. Refresh the page and older generations you didn't
  save are only recoverable by browsing `/songs/<file>` or `/videos/<file>`
  directly if you still have the URL.

### Removed

Accounts, credits, Stripe billing, R2 storage, and an admin role existed in
an earlier version of this app and were deliberately stripped out to keep
this a simple, ungated generator. That code is recoverable from git history
(`git log`) if/when accounts come back.
