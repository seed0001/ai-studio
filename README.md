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

One prompt drives the song and the video's overall look — describe the song
*and* the character/visual style together. The flow is a pausable, editable
storyboard (mirroring the review/regenerate pattern from the movieMaker
project) rather than one fire-and-forget request:

1. **Plan** (`POST /api/generate/video-song`) — generates the song, probes
   its real duration via `ffprobe` (Lyria doesn't report one), splits it into
   ~10s scenes, and asks a cheap text model (`lib/video/shot-list.ts`) to
   turn the one prompt into a *distinct* description per scene — without
   this, every scene got near-identical content and looked repetitive even
   once stitched correctly. Job status becomes `"ready"` once this
   completes; no video generation has happened yet.
2. **Review & edit** — the frontend (`VideoStoryboardEditor.tsx`) shows one
   card per scene with an editable description
   (`PATCH .../scenes/[index]`). Edits take effect on the *next* generation
   of that scene, not retroactively.
3. **Generate** (`POST .../generate`) — generates a first take for every
   scene. Scene 0 runs alone first (it has no reference image and
   establishes the character/style); a still frame gets extracted from
   *whichever take of scene 0 is currently approved* and used to anchor
   every other scene via OpenRouter's `frame_images[]` (`frame_type:
   "first_frame"`) for visual consistency — not `input_references[]`, which
   isn't supported by every provider integration (confirmed: Veo 3.1 Lite
   rejects it). Scenes 1..N then generate in parallel.
4. **Regenerate / approve individual takes** — `POST
   .../scenes/[index]/regenerate` adds a *new* take rather than replacing
   the old one (same as movieMaker); `POST .../scenes/[index]/approve` picks
   which take is currently "the" one for that scene. Nothing is deleted, so
   you can always go back to an earlier take.
5. **Stitch** (`POST .../stitch`) — concatenates whichever take is currently
   approved per scene with the song audio via `ffmpeg`. Idempotent — re-run
   any time takes change to get an updated final video.
- Scene clips can come back at different resolutions/frame rates depending
  on generation mode (scene 0's pure text-to-video vs. the rest's
  image-to-video), so `concatAndMux` (`lib/ffmpeg.ts`) normalizes every clip
  to one resolution via a `filter_complex` re-encode rather than a
  stream-copy concat — the latter silently produced broken/looping output
  when inputs didn't match (confirmed via a live test).
- Cost adds up fast relative to audio-only generation: video runs roughly
  $0.05/scene-second on the default model (Veo 3.1 Lite, without audio), so
  a ~150s full song (≈15 scenes at 10s each) costs several dollars in video
  generation alone. The Clip song length (~30s, ~3 scenes) is far cheaper
  for testing.
- Job state (`lib/video-jobs.ts`) is an **in-memory** map, not a database —
  a job now spans an entire editing session (plan → edit → regenerate →
  re-stitch, potentially hours), so its working files (song + every scene
  take) live in `lib/job-storage.ts` under `data/jobs/<jobId>/` on the same
  persistent volume, served via `app/jobs/[jobId]/[filename]/route.ts`,
  rather than a temp dir cleaned up after one request. A job in progress —
  in-memory state *and* its on-disk files — is lost if the container
  restarts mid-session; oldest job directories beyond a cap are pruned when
  new ones are created. Each pipeline step runs as a fire-and-forget
  background task after its request responds — this relies on Railway's
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
