# PartyVerse feature checklist

Status as of 2026-10-09. **Tested** means covered by an automated test (Vitest unit or Playwright e2e) or
exercised by hand in Chromium against the running app; the column says which.

Test suites: `npm test` (372 unit tests) · `npm run test:e2e` (6 Playwright tests) · `npx next build` passes.

## Games (30)

### The 20 requested games

| Game | Modes | Tested | Notes |
|---|---|---|---|
| Guess the Flag | 9 (classic, type, reverse, fragment, lookalikes, slow reveal, speed, memory, match) | unit + e2e | 250 flags, server-rendered so image URLs never reveal the country |
| Guess the Movie | 9 of 11 | unit + manual | Poster and blurred-poster modes are **off**: they need a licensed image provider |
| Guess the Football Player | 14 of 15 | unit + manual | Photo mode **off** (no licensed photos). Questions only say "has played for" |
| Guess the Celebrity | 5 of 7 | unit | Face/childhood-photo modes **off** (no licensed photos) |
| Guess the Song | 5 of 6 | unit | Audio previews **off** by default; `ENABLE_ITUNES_PREVIEWS=1` turns on Apple's 30s promotional previews |
| Rare Words | 21 categories | unit + manual | Scored by real answer frequency, blended with a documented prior |
| Word Chain | 4 | unit + manual | Solo vs bot only (turn-based chains don't suit simultaneous rooms) |
| Category Battle | letter × category | unit + manual | |
| Higher or Lower | 6 | unit | |
| Guess the Emoji | movies, songs, celebs | unit | |
| Who Am I | 4 | unit | |
| Odd One Out | 5 | unit | Ambiguity check rejects puzzles with two valid odd ones |
| Guess the Year | 6 | unit | |
| Connections | 1 (5 group sources) | unit + manual | Every tile is checked against all four groups |
| Trivia Roulette | 87 (every compatible mode + Community picks) | unit + e2e | |
| Memory Challenge | 3 | unit | |
| Blurred Image | 3 (flags) | unit | Flags only until a licensed photo provider is configured |
| Two Truths and a Lie | 4 | unit + manual | Lies only use fields that are complete in the data |
| Name Five | closed sets + categories | unit | |
| Quickfire | 48 (choice-only mix + Community picks) | unit + e2e | Rounds get shorter as you go |

### 10 originals

| Game | Mechanic | Tested |
|---|---|---|
| Rank It | Put 4–5 items in order | unit |
| Map Mystery | Guess a country; get distance + direction feedback | unit + manual |
| Risk or Reward | Bet on your confidence before seeing the question | unit + manual |
| Speed Sort | Sort 8 items into two buckets against the clock | unit + manual |
| Common Ground | Find what the items share | unit |
| Closest Wins | Numeric estimate, log-scaled closeness scoring | unit |
| Anagram Sprint | Unscramble | unit |
| Letter Drop | Letters appear one at a time | unit |
| Hive Mind | Rare Words inverted: match the crowd | unit |
| Word Forge | Longest dictionary word from 9 letters (typos don't cost tries) | unit + e2e |

## Platform

| Feature | Status | Tested |
|---|---|---|
| Solo play (classic, survival, ranked, daily, chaos variants) | ✅ | unit + e2e |
| Daily challenge (same 10 for everyone, one attempt, daily board) | ✅ | manual |
| Real-time rooms: codes, invite links, public/private, 2–12 players | ✅ | e2e (two browsers) |
| Room modes: classic, teams, survival, chaos, ranked (Elo), tournament | ✅ | manual (classic, chaos via e2e) |
| Spectators, late join, chat with spoiler guard + word filter, emoji reactions | ✅ | e2e (chat), manual |
| Host controls: kick, mute, transfer host, skip, pause, end | ✅ | manual |
| Reconnection (socket state recovery + rejoin by cookie identity) | ✅ | manual |
| Server-authoritative timers, scoring and validation; answers hidden until reveal | ✅ | unit (leak checks on every mode) + e2e |
| Anti-repetition: 180-day history, subject-level near-duplicate blocking, weighted selection, adaptive difficulty | ✅ | unit |
| Game Master room host: classic (free) or AI, falls back to classic | ✅ | unit + e2e (classic). AI path not run against a live API |
| Guests, accounts (username + password), profiles, avatars, XP/levels | ✅ | manual |
| Achievements (14) | ✅ | manual |
| Friends (add by username, accept, remove) | ✅ | manual |
| Leaderboards (daily, XP, wins, ranked, per game) | ✅ | manual |
| Content reports; 3 reports auto-hide a question | ✅ | manual |
| Sounds (synthesised, mutable), confetti, animations | ✅ | manual |
| Phone layout (390px, no horizontal scroll on main pages) | ✅ | manual |

## Content engine & admin

| Feature | Status | Tested |
|---|---|---|
| Question index in Postgres (15,646 dataset questions, sources, licences) | ✅ `npm run db:seed`, also synced on server start | manual |
| Dataset integrity checks (no clue names its answer, records ordered, etc.) | ✅ | unit |
| Question pipeline: provider → schema/giveaway/language/near-duplicate checks → review | ✅ | unit + manual |
| Non-AI provider (templates over verified datasets) | ✅ | unit + manual |
| AI providers (Anthropic, OpenAI-compatible) behind `AI_PROVIDER`/`AI_API_KEY` | ✅ code; drafts always need human review | unit (parsing, off-by-default). **Not run against a live API** |
| "Community picks" mode serving published custom questions | ✅ | unit + manual |
| Admin dashboard: metrics, live rooms, review queue, question search/retire/edit, reports, generation jobs, game enable/scoring, users (ban, roles) | ✅ | manual (Chromium) + e2e (hidden from guests) |
| Admin security: page and APIs return 404 to non-staff; role checks per action; audit events | ✅ | e2e |

## Pending / not done

- **Horizontal scaling**: rooms, timers and rate limits live in one Node process. Multi-instance needs a Redis adapter plus shared room state. Run one instance for now.
- **Licensed images**: movie posters, celebrity and footballer photos are not bundled (copyright). Those modes stay hidden until an image provider with per-image licences (e.g. Wikimedia Commons with attribution) is added.
- **Account recovery**: no email, so no password reset or email verification.
- **AI providers** have not been exercised with a real key in this environment.
- **Load testing** and an accessibility audit have not been done.
- **Deployment**: no Dockerfile/hosting config yet; needs Postgres and one Node process (`npm run build && npm start`).
