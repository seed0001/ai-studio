# AI Studio

A simple, stateless music generator. Enter a prompt, pick a model, get a song.
No accounts, no database, no billing — just generation. (Video, audiobooks,
podcasts, and full episodes are the eventual direction; this is the first
slice.)

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind)
- Local disk storage (`data/songs/`) — on Railway this is a mounted volume
  so files survive redeploys; only the most recent 3 songs are kept
- OpenRouter — `google/lyria-3-pro-preview` / `google/lyria-3-clip-preview`

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

- Selectable music models live in `lib/music/models.ts` — add an entry there
  to expose another OpenRouter model in the dropdown.
- Music generation is wrapped behind `MusicProvider` (`lib/music/provider.ts`)
  so the OpenRouter integration (`lib/music/openrouter.ts`) can be swapped or
  adjusted in one place. OpenRouter's Lyria 3 audio-output support is a newer,
  thinly-documented feature — the audio comes back streamed (`stream: true`,
  reassembled from SSE deltas in `openrouter.ts`), since non-streaming
  requests are rejected. Re-verify the delta shape if this starts failing.
- Storage (`lib/storage.ts`) writes generated files to `data/songs/`, served
  through `app/songs/[filename]/route.ts` at `/songs/<file>` — deliberately
  not under `public/`, since Next's static file serving for `public/` appears
  to work off a build-time snapshot and won't pick up files written there at
  runtime (confirmed: the file existed on disk but 404'd). After each
  generation, the oldest files beyond the 3 most recent are deleted
  (`MAX_SONGS` in `storage.ts`). Locally this directory is just a normal
  (gitignored) folder; in production it's a Railway volume mounted at
  `/app/data/songs` on the `web` service, so files persist across deploys
  instead of vanishing when the container restarts.
- There's still no database: nothing is recorded outside the 3 files
  currently on disk. Refresh the page and older generations you didn't save
  are only recoverable by browsing `/songs/<file>` directly if you still
  have the URL.
- Accounts, credits, Stripe billing, R2 storage, and an admin role existed in
  an earlier version of this app and were deliberately stripped out to keep
  this a simple, ungated generator. That code is recoverable from git history
  (`git log`) if/when accounts come back.
