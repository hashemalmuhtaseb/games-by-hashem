# PartyVerse

A real-time party games platform: 30 games (20 classics + 10 originals), solo and multiplayer rooms,
a daily challenge, an anti-repetition content engine and an admin dashboard. It runs fully without AI;
AI providers are optional extras.

See [docs/CHECKLIST.md](docs/CHECKLIST.md) for what is implemented, tested and pending.

## Stack

Next.js 15 (App Router) + React 19 + TypeScript · Tailwind v4 · Framer Motion · Socket.IO (same process,
custom `server.ts`) · Postgres + Prisma · Zod · Vitest · Playwright.

## Run it

```bash
cp .env.example .env            # set DATABASE_URL and SESSION_SECRET
npm install
npx prisma db push              # create tables
npm run db:seed                 # index the bundled question catalogue (also runs on server start)
npm run dev                     # http://localhost:3000
```

Admin: set `ADMIN_USERNAME` before registering that username, or run `npm run make-admin -- <username>`.
The dashboard is at `/admin` and is a 404 for everyone else.

Tests: `npm test` (unit) and `npm run test:e2e` (starts a server on :3100; set `E2E_BASE_URL` to reuse one,
`PW_CHROMIUM_PATH` to use a preinstalled Chromium).

## How it fits together

- `src/engine` is pure game logic. A game is a set of **modes**; each mode lists cheap **candidates** (one per
  possible question) and **builds** a round. A round is split into `pub` (sent to browsers) and `secret`
  (stays on the server until the reveal). Unit tests build rounds for every mode and assert nothing secret leaks.
- `src/engine/selection.ts` is the anti-repetition engine: per-player history (180 days), subject-level
  near-duplicate blocking, weighted random choice and adaptive difficulty.
- `src/server` holds the stateful parts: solo sessions, rooms (`rooms.ts`, Socket.IO handlers in `socket.ts`),
  progression, leaderboards, the Game Master and the content pipeline jobs.
- `src/content` holds the datasets (with sources and reference dates in each file header), the custom-question
  store and the pipeline (`pipeline/validate.ts`, `pipeline/providers.ts`).

## Content and licensing

- Countries: mledoze/countries (ODbL-1.0). Flags: country-flag-icons (MIT). Dictionary: an-array-of-english-words (MIT).
- Movies, songs, football and celebrity facts are public record; plots, descriptions, clues and emoji are original writing.
- No posters, photos, lyrics or audio are bundled. Song previews are an opt-in Apple iTunes integration.
- AI-generated questions are never published automatically; they wait in the admin review queue.

## Security notes

Answers are only sent at reveal time; media URLs are opaque tokens; every socket event and API body is
validated with Zod and rate limited; identity comes from signed httpOnly cookies; admin endpoints return 404
to non-staff; user listings never include emails or password hashes.
