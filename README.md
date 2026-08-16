# AI Studio

Landing site + music generation, phase one of an AI content studio (music now;
video, audiobooks, podcasts, and full episodes later). Music generation runs
through OpenRouter (Google Lyria 3), files land in Cloudflare R2, sign-in is
Google OAuth or email magic link, and credits are purchased one-time through
Stripe Checkout.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind)
- Postgres + Prisma 7 (driver adapters, `@prisma/adapter-pg`)
- Auth.js v5 — Google OAuth + email magic link (Resend)
- Stripe Checkout — one-time credit packs
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

   See `.env.example` for what each variable is and where to get it. You'll need:
   - A Postgres database (`DATABASE_URL`)
   - A Google OAuth client (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`)
   - A Resend API key for magic-link emails (`AUTH_RESEND_KEY`)
   - An OpenRouter API key (`OPENROUTER_API_KEY`)
   - Cloudflare R2 credentials + bucket (`R2_*`)
   - Stripe secret key, webhook secret, and three **one-time** Price IDs for
     the Starter/Creator/Pro packs (`STRIPE_*`) — create the products in the
     Stripe Dashboard first, packs are configured in `lib/credit-packs.ts`
   - An `AUTH_SECRET` — generate with `npx auth secret`

3. **Push the schema to your database**

   ```bash
   npx prisma migrate dev --name init
   ```

4. **Run the dev server**

   ```bash
   npm run dev
   ```

5. **Forward Stripe webhooks locally** (in a separate terminal, requires the
   [Stripe CLI](https://stripe.com/docs/stripe-cli))

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   Copy the printed webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Notes

- **The very first account ever created is automatically made admin**
  (`lib/auth.ts`, `events.createUser`). This only fires once — on a fresh
  database, whoever signs in first gets the `ADMIN` role. If you need to
  promote someone else later, update their `role` directly in the database.
  Admins see an `/admin` link with basic studio stats (user count,
  generation count, credits purchased, recent signups).
- Selectable music models (and their per-model credit cost / nominal duration)
  live in `lib/music/models.ts` — add an entry there to expose a new
  OpenRouter model in the dashboard dropdown. Credit pack sizes/prices are in
  `lib/credit-packs.ts`.
- Music generation is wrapped behind `MusicProvider` (`lib/music/provider.ts`)
  so the OpenRouter integration (`lib/music/openrouter.ts`) can be swapped or
  adjusted in one place. OpenRouter's Lyria 3 audio-output support is a newer,
  thinly-documented feature — verify the response shape with a real API key
  before relying on it in production, and adjust `openrouter.ts` if the
  `message.audio` field differs from what's assumed there.
- Future media types (video, audiobooks, podcasts, episodes) should follow the
  same pattern: a `GenerationType` enum value, a provider interface under
  `lib/<type>/`, and a route under `app/api/generate/<type>/`.
