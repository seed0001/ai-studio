# AI Studio

A simple, stateless music generator. Enter a prompt, pick a model, get a song.
No accounts, no database, no billing — just generation. (Video, audiobooks,
podcasts, and full episodes are the eventual direction; this is the first
slice.)

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind)
- Cloudflare R2 — generated audio storage
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

   You'll need:
   - An OpenRouter API key (`OPENROUTER_API_KEY`)
   - Cloudflare R2 credentials + bucket (`R2_*`)

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
  thinly-documented feature — verify the response shape with a real API key
  before relying on it in production, and adjust `openrouter.ts` if the
  `message.audio` field differs from what's assumed there.
- There's no persistence: generated audio is uploaded to R2 and the URL is
  returned directly to the browser, but nothing is recorded anywhere. If you
  navigate away, the file still exists in R2 (find it by browsing the
  bucket), but the app has no memory of it.
- Accounts, credits, Stripe billing, and an admin role existed in an earlier
  version of this app and were deliberately stripped out to keep this a
  simple, ungated generator. That code is recoverable from git history
  (`git log`) if/when accounts come back.
